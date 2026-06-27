import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Alçada del panell quan està minimitzat: el header (32px) més espai per
   mostrar les últimes entrades de previsualització. Cal un valor numèric
   explícit perquè la transició CSS pugui animar. */
const MINIMIZED_HEIGHT_PX = 110

/** Nombre d'entrades recents mostrades a la previsualització minimitzada. */
const MINIMIZED_PREVIEW_COUNT = 3

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
    soloFilter,
    setSearch,
    clear,
  } = useDevConsole()

  const bodyRef = useRef<HTMLDivElement>(null)

  /* Scroll bloquejat: quan és true, l'auto-scroll a baix es congela mentre
     inspecciones logs antics. PERÒ si ja estàs enganxat al fons, els logs nous
     continuen seguint-se igualment — el lock només actua quan no estàs a baix. */
  const [scrollLocked, setScrollLocked] = useState(false)
  const toggleScrollLock = useCallback(() => setScrollLocked((v) => !v), [])

  /* Mirall del lock en un ref perquè l'efecte d'auto-scroll el pugui llegir
     sense dependre'n: així, desbloquejar NO provoca un salt immediat al fons;
     el seguiment només es reprèn a la pròxima entrada nova. */
  const scrollLockedRef = useRef(scrollLocked)
  scrollLockedRef.current = scrollLocked

  /* Estàvem enganxats al fons abans de l'última actualització? Es mesura abans
     de renderitzar les noves entrades, amb un petit marge de tolerància. */
  const wasAtBottomRef = useRef(true)

  /* Auto-scroll al fons quan arriben entrades noves, mantenint el seguiment
     si NO està bloquejat o si l'usuari ja era al fons. El body es manté sempre
     muntat (s'amaga via CSS en minimitzar), així que `scrollTop` mai es perd;
     per això no cal desar/restaurar cap posició manualment.

     Mentre està minimitzat el body té `display:none` i no té dimensions de
     scroll fiables, així que l'auto-scroll es difereix fins que es restaura
     (deps inclou `minimized`): en obrir-se, si toca, salta al fons actual. */
  useEffect(() => {
    const el = bodyRef.current
    if (!visible || minimized || !el) return
    if (!scrollLockedRef.current || wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries, visible, minimized])

  const setBodyRef = useCallback((el: HTMLDivElement | null) => {
    bodyRef.current = el
  }, [])

  /* Manté actualitzat el flag "al fons" amb cada scroll de l'usuari. */
  const onBodyScroll = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }, [])

  const onResizeStart = useResizeDrag(setHeight)

  const toggleMinimized = useCallback(() => {
    if (minimized) expand()
    else minimize()
  }, [minimized, expand, minimize])

  /* Només minimitza la part esquerra del header: el títol i l'espai buit fins
     on comença la zona de controls. Un clic sobre els filtres, la cerca o els
     botons (tots agrupats a la dreta) conserva la seva acció i no commuta. */
  const onHeadClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.dev-console__controls')) return
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

  const copyAll = useCallback(() => {
    const text = filtered
      .map((e) => `${formatTime(e.ts)} ${e.level.toUpperCase()} ${e.text}`)
      .join('\n')
    void navigator.clipboard?.writeText(text)
  }, [filtered])

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

        {/* Toolbar (hidden when minimized) */}
        {!minimized && (
          <div className="dev-console__toolbar">
            <div className="dev-console__controls">
            <div className="dev-console__filters" role="group" aria-label="Nivells">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  className={`dev-console__filter dev-console__filter--${level}${filters.has(level) ? ' dev-console__filter--active' : ''}`}
                  onClick={(e) => (e.metaKey || e.ctrlKey ? soloFilter(level) : toggleFilter(level))}
                  aria-pressed={filters.has(level)}
                  title={`Mostra/amaga ${level} · ⌘+clic per veure'n només aquest`}
                >
                  {level}
                </button>
              ))}
            </div>
            <input
              className="dev-console__search"
              type="text"
              placeholder="Filtra…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cerca als logs"
            />
            <div className="dev-console__actions">
              <button
                className={`dev-console__action-btn${scrollLocked ? ' dev-console__action-btn--on' : ''}`}
                onClick={toggleScrollLock}
                title={scrollLocked ? 'Desbloqueja el scroll automàtic' : 'Bloqueja el scroll automàtic'}
                aria-pressed={scrollLocked}
              >
                {scrollLocked ? 'Locked' : 'Lock'}
              </button>
              <button
                className="dev-console__action-btn"
                onClick={copyAll}
                title="Copia els logs al portapapers"
              >
                Copy
              </button>
              <button
                className="dev-console__action-btn"
                onClick={clear}
                title="Esborra els logs"
              >
                Clear
              </button>
              <button
                className="dev-console__action-btn dev-console__action-btn--icon"
                onClick={hide}
                title="Tanca la consola"
                aria-label="Tanca"
              >
                ✕
              </button>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Minimized preview: últimes entrades */}
      {minimized && filtered.length > 0 && (
        <div className="dev-console__preview" aria-hidden="true">
          {filtered.slice(-MINIMIZED_PREVIEW_COUNT).map((entry) => (
            <div
              key={entry.id}
              className={`dev-console__line dev-console__line--${entry.level}`}
            >
              <span className="dev-console__ts">{formatTime(entry.ts)}</span>
              <span className={`dev-console__badge dev-console__badge--${entry.level}`}>
                {entry.level}
              </span>
              <span className="dev-console__msg">{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log body — sempre muntat (encara que minimitzat s'amagui via CSS)
          perquè la posició de scroll no es perdi ni calgui reajustar-la. */}
      <div
        className="dev-console__body"
        ref={setBodyRef}
        onScroll={onBodyScroll}
        hidden={minimized}
      >
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
    </div>
  )
}
