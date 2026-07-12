/* Dev-mode activity log engine.
   Fully framework-agnostic: no React, no DOM. Captures console output,
   unhandled errors, and explicit app-level events. Buffer writes are
   synchronous (entries are never lost) but subscriber notification is
   deferred to a microtask and coalesced: a console.* call during a React
   render never triggers a synchronous state update, and a subscriber that
   logs while being notified can never re-enter the pipeline synchronously. */

export type LogLevel =
  | 'log'
  | 'info'
  | 'warn'
  | 'error'
  | 'action'
  | 'api'
  | 'query'

export interface LogEntry {
  id: number
  ts: number
  level: LogLevel
  text: string
}

type Subscriber = (event: LogEvent) => void
type LogEvent = { type: 'append'; entries: LogEntry[] } | { type: 'clear' }

export const MAX_ENTRIES = 500
const ALWAYS_CAPTURE: ReadonlySet<LogLevel> = new Set(['error'])

let _seq = 0
const _buffer: LogEntry[] = []
const _subscribers = new Set<Subscriber>()
let _capturing = false
let _installed = false
let _globalInstalled = false

// Notification queue: pushes/clears accumulate here until the next flush.
let _pendingEntries: LogEntry[] = []
let _pendingClear = false
let _flushScheduled = false

// ── Original console refs ────────────────────────────────────────────────────

const _orig = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

// ── Safe serialisation ───────────────────────────────────────────────────────

function safeText(...args: unknown[]): string {
  return args
    .map((a) => {
      if (a === null) return 'null'
      if (a === undefined) return 'undefined'
      if (typeof a === 'string') return a
      if (a instanceof Error) return a.stack ?? a.message
      try {
        return JSON.stringify(a)
      } catch {
        return Object.prototype.toString.call(a)
      }
    })
    .join(' ')
}

/* Longitud màxima del cos serialitzat d'una resposta de query abans de
   retallar-lo. Les respostes de TanStack (snapshots) poden ser enormes; la
   consola només n'ha de mostrar una previsualització llegible. */
const MAX_PAYLOAD_CHARS = 600

function truncate(text: string): string {
  return text.length > MAX_PAYLOAD_CHARS
    ? `${text.slice(0, MAX_PAYLOAD_CHARS)}… (${text.length} chars)`
    : text
}

// ── Core log ─────────────────────────────────────────────────────────────────

function push(level: LogLevel, ...args: unknown[]): void {
  if (!_capturing && !ALWAYS_CAPTURE.has(level)) return

  const entry: LogEntry = {
    id: ++_seq,
    ts: Date.now(),
    level,
    text: safeText(...args),
  }

  if (_buffer.length >= MAX_ENTRIES) _buffer.shift()
  _buffer.push(entry)

  _pendingEntries.push(entry)
  scheduleFlush()
}

/* Notification is decoupled from the console call. Multiple pushes in the
   same tick coalesce into a single flush; a push made from inside a
   notification only schedules the next flush, so the console interceptor
   never recurses. */
function scheduleFlush(): void {
  if (_flushScheduled) return
  _flushScheduled = true
  queueMicrotask(flush)
}

function flush(): void {
  _flushScheduled = false
  const clear = _pendingClear
  const entries = _pendingEntries
  _pendingClear = false
  _pendingEntries = []

  if (clear) emit({ type: 'clear' })
  if (entries.length > 0) emit({ type: 'append', entries })
}

function emit(event: LogEvent): void {
  for (const sub of [..._subscribers]) {
    try {
      sub(event)
    } catch {
      /* never let a buggy subscriber kill the logger */
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const devLog = {
  /* Install console interceptors (idempotent). Call once at app boot. */
  install(): void {
    if (_installed) return
    _installed = true

    const capture =
      (level: LogLevel, orig: (...a: unknown[]) => void) =>
      (...args: unknown[]) => {
        orig(...args)
        push(level, ...args)
      }

    console.log = capture('log', _orig.log)
    console.info = capture('info', _orig.info)
    console.warn = capture('warn', _orig.warn)
    console.error = capture('error', _orig.error)
  },

  /* Install global error handlers (idempotent). Always active — errors are
     recorded regardless of the capturing flag. */
  installGlobalHandlers(): void {
    if (_globalInstalled) return
    _globalInstalled = true

    window.addEventListener('error', (e) => {
      const msg =
        e.error instanceof Error
          ? (e.error.stack ?? e.error.message)
          : e.message
      push('error', msg)
    })

    window.addEventListener('unhandledrejection', (e) => {
      const reason: unknown = e.reason
      const msg =
        reason instanceof Error
          ? (reason.stack ?? reason.message)
          : safeText(reason)
      push('error', `Unhandled rejection: ${msg}`)
    })
  },

  setCapturing(on: boolean): void {
    _capturing = on
  },

  get isCapturing(): boolean {
    return _capturing
  },

  /* Log an explicit error (not a console.* call). Always recorded, even when
     capturing is off, so failures surface in the dev console regardless. */
  error(...args: unknown[]): void {
    push('error', ...args)
  },

  /* Log an explicit app-level action (not a console.* call). */
  action(label: string, detail?: unknown): void {
    push('action', detail !== undefined ? `${label} ${safeText(detail)}` : label)
  },

  /* Log an API call. */
  api(method: string, path: string, statusOrDetail?: unknown): void {
    const tail =
      statusOrDetail !== undefined ? ` → ${safeText(statusOrDetail)}` : ''
    push('api', `${method} ${path}${tail}`)
  },

  /* Log a TanStack Query cache event (resolved data or error). The payload is
     truncated so large snapshots don't flood the console; the full object is
     always available via the React Query store. */
  query(status: string, key: string, payload?: unknown): void {
    if (!_capturing) return
    const tail =
      payload !== undefined ? ` → ${truncate(safeText(payload))}` : ''
    push('query', `${status} ${key}${tail}`)
  },

  /* Snapshot of the current buffer (newest last). */
  getEntries(): LogEntry[] {
    return [..._buffer]
  },

  clear(): void {
    _buffer.length = 0
    _pendingEntries = [] // superseded: they were cleared before delivery
    _pendingClear = true
    scheduleFlush()
  },

  subscribe(fn: Subscriber): () => void {
    _subscribers.add(fn)
    return () => _subscribers.delete(fn)
  },
}
