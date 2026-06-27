/* DevConsoleProvider — the only export from this file is the component,
   so Fast Refresh works correctly. Context + types live in ./dev-console-context.ts
   and the hook lives in ./useDevConsole.ts. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { devLog, MAX_ENTRIES, type LogEntry, type LogLevel } from './dev-log'
import { DevConsoleContext, type DevConsoleContextValue } from './dev-console-context'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { useRegisterModal } from '../modals/useRegisterModal'

// ── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE = {
  visible: 'mirador.devConsole.visible',
  height: 'mirador.devConsole.height',
  minimized: 'mirador.devConsole.minimized',
  filters: 'mirador.devConsole.filters',
} as const

const DEFAULT_HEIGHT = 240
const DEFAULT_FILTERS: ReadonlySet<LogLevel> = new Set([
  'log', 'info', 'warn', 'error', 'action', 'api', 'query',
])

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}

function readInt(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const n = parseInt(raw, 10)
    return isNaN(n) ? fallback : n
  } catch {
    return fallback
  }
}

function readFilters(): Set<LogLevel> {
  try {
    const raw = localStorage.getItem(STORAGE.filters)
    if (!raw) return new Set(DEFAULT_FILTERS)
    const parsed = JSON.parse(raw) as LogLevel[]
    return new Set(parsed)
  } catch {
    return new Set(DEFAULT_FILTERS)
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota / private mode — ignore */
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function DevConsoleProvider({ children }: { children: ReactNode }) {
  const { enabled: devMode } = useDeveloperMode()

  const [entries, setEntries] = useState<LogEntry[]>(() => devLog.getEntries())
  const [visible, setVisible] = useState(() => readBool(STORAGE.visible, false))
  const [minimized, setMinimized] = useState(() => readBool(STORAGE.minimized, false))
  const [height, setHeightState] = useState(() => readInt(STORAGE.height, DEFAULT_HEIGHT))
  const [filters, setFilters] = useState<Set<LogLevel>>(readFilters)
  const [search, setSearchState] = useState('')

  // Registra l'estat obert al registre de modals
  useRegisterModal('dev-console', visible)

  /* Boot: install interceptors once at mount */
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    devLog.install()
    devLog.installGlobalHandlers()
  }, [])

  /* Sync capturing with dev mode. setVisible is deferred so it runs outside
     the effect body, satisfying the no-setState-in-effect lint rule. */
  useEffect(() => {
    devLog.setCapturing(devMode)
    if (!devMode) {
      const timer = setTimeout(() => {
        setVisible(false)
        persist(STORAGE.visible, 'false')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [devMode])

  /* Subscribe to log engine. Initial hydration is handled by the useState
     initializer above, so setState is never called directly in this effect. */
  useEffect(() => {
    const unsub = devLog.subscribe((event) => {
      if (event.type === 'clear') {
        setEntries([])
      } else {
        setEntries((prev) => {
          const next = [...prev, event.entry]
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
        })
      }
    })
    return unsub
  }, [])

  const show = useCallback(() => {
    setVisible(true)
    persist(STORAGE.visible, 'true')
  }, [])

  const hide = useCallback(() => {
    setVisible(false)
    persist(STORAGE.visible, 'false')
  }, [])

  const toggle = useCallback(() => {
    setVisible((v) => {
      const next = !v
      persist(STORAGE.visible, next ? 'true' : 'false')
      return next
    })
  }, [])

  const minimize = useCallback(() => {
    setMinimized(true)
    persist(STORAGE.minimized, 'true')
  }, [])

  const expand = useCallback(() => {
    setMinimized(false)
    persist(STORAGE.minimized, 'false')
  }, [])

  const setHeight = useCallback((px: number) => {
    const clamped = Math.max(80, Math.min(px, window.innerHeight * 0.6))
    setHeightState(clamped)
    persist(STORAGE.height, String(Math.round(clamped)))
  }, [])

  const toggleFilter = useCallback((level: LogLevel) => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      persist(STORAGE.filters, JSON.stringify([...next]))
      return next
    })
  }, [])

  /* Solo: ⌘/Ctrl+clic per construir una selecció acumulativa.
     - Des de l'estat "tots actius", el primer clic deixa només aquest nivell.
     - Mentre ja s'està en mode solo (subconjunt parcial), cada clic afegeix
       o treu el nivell, permetent triar-ne diversos sense reiniciar.
     - Si el resultat queda buit, es restauren tots els nivells. */
  const soloFilter = useCallback((level: LogLevel) => {
    setFilters((prev) => {
      const isFullSet = prev.size === DEFAULT_FILTERS.size
      let next: Set<LogLevel>
      if (isFullSet) {
        // Primer solo: aïlla aquest nivell.
        next = new Set<LogLevel>([level])
      } else {
        // Ja en mode solo: afegeix/treu del subconjunt.
        next = new Set(prev)
        if (next.has(level)) next.delete(level)
        else next.add(level)
        if (next.size === 0) next = new Set(DEFAULT_FILTERS)
      }
      persist(STORAGE.filters, JSON.stringify([...next]))
      return next
    })
  }, [])

  const setSearch = useCallback((q: string) => {
    setSearchState(q)
  }, [])

  const clear = useCallback(() => {
    devLog.clear()
  }, [])

  const value: DevConsoleContextValue = {
    entries,
    visible,
    minimized,
    height,
    filters,
    search,
    show,
    hide,
    toggle,
    minimize,
    expand,
    setHeight,
    toggleFilter,
    soloFilter,
    setSearch,
    clear,
  }

  return (
    <DevConsoleContext.Provider value={value}>
      {children}
    </DevConsoleContext.Provider>
  )
}
