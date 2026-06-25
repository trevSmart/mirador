import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDevConsole } from './useDevConsole'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import type { LogLevel } from './dev-log'

// ── Level meta ───────────────────────────────────────────────────────────────

const LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'action', 'api']

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

// ── Resize handle ────────────────────────────────────────────────────────────

function useResizeDrag(onResize: (px: number) => void) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const startH = document.querySelector('.dev-console')?.getBoundingClientRect().height ?? 240

      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY
        onResize(startH + delta)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onResize],
  )
  return onMouseDown
}

/** Alçada del panell quan està minimitzat (coincideix amb l'alçada del header).
   Cal un valor numèric explícit perquè la transició CSS pugui animar. */
const MINIMIZED_HEIGHT_PX = 32

// ── Main component ───────────────────────────────────────────────────────────

export function DevConsole() {
  const { enabled: devMode } = useDeveloperMode()
  const {
    entries,
    visible,
    minimized,
    height,
    filters,
    search,
    hide,
    minimize,
    expand,
    setHeight,
    toggleFilter,
    setSearch,
    clear,
  } = useDevConsole()

  const bodyRef = useRef<HTMLDivElement>(null)

  /* Auto-scroll to bottom when new entries arrive, on open, and when expanded */
  useEffect(() => {
    if (visible && !minimized && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [entries, minimized, visible])

  const onResizeStart = useResizeDrag(setHeight)

  const toggleMinimized = useCallback(() => {
    if (minimized) expand()
    else minimize()
  }, [minimized, expand, minimize])

  /* Qualsevol clic al header commuta, EXCEPTE sobre un control interactiu
     (input o botó), que conserva la seva pròpia acció. */
  const onHeadClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, input')) return
      toggleMinimized()
    },
    [toggleMinimized],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (!filters.has(e.level)) return false
      if (q && !e.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, filters, search])

  if (!devMode || !visible) return null

  return (
    <div
      className={`dev-console${minimized ? ' dev-console--minimized' : ''}`}
      style={{ height: minimized ? MINIMIZED_HEIGHT_PX : height }}
    >
      {/* Drag handle */}
      {!minimized && (
        <div
          className="dev-console__resize"
          onMouseDown={onResizeStart}
          aria-hidden="true"
        />
      )}

      {/* Header — qualsevol clic minimitza o restaura la consola */}
      <div
        className="dev-console__head"
        onClick={onHeadClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleMinimized()
          }
        }}
        aria-label={minimized ? 'Expandeix la consola' : 'Minimitza la consola'}
      >
        <span className="dev-console__title">Console</span>

        {/* Minimized preview: last entry */}
        {minimized && filtered.length > 0 && (
          <div className="dev-console__preview" aria-hidden="true">
            <span className="dev-console__ts">
              {formatTime(filtered[filtered.length - 1].ts)}
            </span>
            <span
              className={`dev-console__badge dev-console__badge--${filtered[filtered.length - 1].level}`}
            >
              {filtered[filtered.length - 1].level}
            </span>
            <span className="dev-console__preview-msg">
              {filtered[filtered.length - 1].text}
            </span>
          </div>
        )}

        {/* Toolbar (hidden when minimized) */}
        {!minimized && (
          <div className="dev-console__toolbar">
            <input
              className="dev-console__search"
              type="text"
              placeholder="Filtra…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cerca als logs"
            />
            <div className="dev-console__filters" role="group" aria-label="Nivells">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  className={`dev-console__filter dev-console__filter--${level}${filters.has(level) ? ' dev-console__filter--active' : ''}`}
                  onClick={() => toggleFilter(level)}
                  aria-pressed={filters.has(level)}
                  title={`Mostra/amaga ${level}`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="dev-console__actions">
              <button
                className="dev-console__action-btn"
                onClick={clear}
                title="Esborra els logs"
              >
                Esborra
              </button>
              <button
                className="dev-console__action-btn"
                onClick={hide}
                title="Tanca la consola"
                aria-label="Tanca"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Expand / minimize toggle */}
        <button
          className="dev-console__toggle"
          onClick={toggleMinimized}
          aria-label={minimized ? 'Expandeix la consola' : 'Minimitza la consola'}
          title={minimized ? 'Expandeix' : 'Minimitza'}
        >
          {minimized ? '▲' : '▼'}
        </button>
      </div>

      {/* Log body */}
      {!minimized && (
        <div className="dev-console__body" ref={bodyRef}>
          {filtered.length === 0 ? (
            <div className="dev-console__empty">Cap activitat registrada.</div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className={`dev-console__line dev-console__line--${entry.level}`}>
                <span className="dev-console__ts">{formatTime(entry.ts)}</span>
                <span className={`dev-console__badge dev-console__badge--${entry.level}`}>
                  {entry.level}
                </span>
                <span className="dev-console__msg">{entry.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
