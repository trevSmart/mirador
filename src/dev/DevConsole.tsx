import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDevConsole } from './useDevConsole'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import type { LogEntry, LogLevel } from './dev-log'

// ── Level meta ───────────────────────────────────────────────────────────────

const LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'action', 'api', 'query']

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

/** Nombre d'entrades recents VISIBLES a la previsualització minimitzada. */
const MINIMIZED_PREVIEW_COUNT = 3

/** Línies realment renderitzades: una més de les visibles. L'extra queda
   retallada per `overflow:hidden` i és la que es veu sortir per dalt mentre el
   bloc llisca amunt en arribar una entrada nova (efecte teletip). */
const MINIMIZED_RENDER_COUNT = MINIMIZED_PREVIEW_COUNT + 1

// ── Single log line ──────────────────────────────────────────────────────────

/* Una entrada del cos. Per defecte el missatge queda col·lapsat a una sola línia
   (line-clamp via CSS); el botó d'expandir només apareix quan el text REALMENT
   desborda, mesurat comparant scrollHeight/clientHeight en estat col·lapsat. La
   mesura es difereix a un useLayoutEffect i només es refà quan canvia el text o
   es torna a col·lapsar, així no recalculem en va per cada entrada nova. */
function LogLine({ entry, minimized }: { entry: LogEntry; minimized: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const msgRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = msgRef.current
    // Mentre està expandit el clamp no aplica, així que no és mesurable: conservem
    // l'últim valor d'overflow (que per força era true perquè el botó hi era).
    // I mentre la consola està minimitzada el cos té `display:none`, on totes les
    // mesures donen 0; per això hi depenem de `minimized` i remesurem en obrir-la.
    if (!el || expanded || minimized) return
    setOverflowing(el.scrollHeight - el.clientHeight > 1)
  }, [entry.text, expanded, minimized])

  /* En expandir, el missatge creix cap avall dins el cos (scroll propi). Si
     l'entrada era a prop de la vora inferior, el contingut nou quedaria tallat
     sota el límit visible sense cap indici. Portem la línia sencera a la vista
     perquè el text expandit i el desplaçament de les entrades de sota siguin
     evidents. Només en obrir; en col·lapsar es manté la posició. */
  useLayoutEffect(() => {
    if (expanded) lineRef.current?.scrollIntoView({ block: 'nearest' })
  }, [expanded])

  const toggle = useCallback(() => setExpanded((v) => !v), [])

  return (
    <div ref={lineRef} className={`dev-console__line dev-console__line--${entry.level}`}>
      <span className="dev-console__ts">{formatTime(entry.ts)}</span>
      <span className={`dev-console__badge dev-console__badge--${entry.level}`}>
        {entry.level}
      </span>
      <span
        ref={msgRef}
        className={`dev-console__msg${expanded ? '' : ' dev-console__msg--collapsed'}`}
      >
        {entry.text}
      </span>
      {(overflowing || expanded) && (
        <button
          className={`dev-console__expand${expanded ? ' dev-console__expand--open' : ''}`}
          onClick={toggle}
          aria-expanded={expanded}
          title={expanded ? 'Col·lapsa el missatge' : 'Expandeix el missatge'}
          aria-label={expanded ? 'Col·lapsa el missatge' : 'Expandeix el missatge'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}
    </div>
  )
}

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
  // Patró "mirall en ref" recomanat per React per llegir el valor més recent
  // des d'un efecte sense dependre'n. L'escriptura durant el render és segura ací.
  // eslint-disable-next-line react-hooks/refs
  scrollLockedRef.current = scrollLocked

  /* Estàvem enganxats al fons abans de l'última actualització? Es mesura abans
     de renderitzar les noves entrades, amb un petit marge de tolerància. */
  const wasAtBottomRef = useRef(true)

  /* Auto-scroll al fons quan arriben entrades noves, mantenint el seguiment
     si NO està bloquejat o si l'usuari ja era al fons. El body es manté sempre
     muntat (s'amaga via CSS en minimitzar), així que `scrollTop` mai es perd.

     Mentre està minimitzat el body té `display:none` i no és mesurable, per
     això l'ajust es difereix. Però en RESTAURAR (minimized passa a false) cal
     que el scroll ja estigui a baix sense flaix visible: useLayoutEffect corre
     síncron abans del paint, així que el reposicionament és imperceptible. */
  useLayoutEffect(() => {
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

  const previewSlice = minimized ? filtered.slice(-MINIMIZED_RENDER_COUNT) : []
  const newestPreviewId = previewSlice.at(-1)?.id ?? null

  /* Id de l'última entrada arribada mentre minimitzat. Serveix de `key` del
     contenidor de la previsualització: en canviar, React remunta el bloc i el
     `@keyframes` de desplaçament es reprodueix net (tot el bloc llisca amunt una
     alçada de línia, efecte teletip). La detecció es fa a un `useLayoutEffect`
     (no durant el render) perquè mutar un ref dins el render es comporta malament
     amb el doble render de StrictMode: el segon passi veuria el ref ja
     actualitzat i no detectaria mai l'entrada nova.

     El ref NOMÉS s'actualitza mentre minimitzat: estant expandit no hi ha
     previsualització, així que en restaurar conserva l'últim id vist i no es
     dispara una animació espúria pel simple fet de minimitzar — només quan
     arriba realment una entrada nova. Inicialitzat a `undefined` per distingir
     el primer cop (que no anima) d'un canvi real d'id. */
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const lastPreviewIdRef = useRef<string | null | undefined>(undefined)
  useLayoutEffect(() => {
    if (!minimized) return
    if (
      lastPreviewIdRef.current !== undefined &&
      newestPreviewId !== null &&
      newestPreviewId !== lastPreviewIdRef.current
    ) {
      setEnteringId(newestPreviewId)
    }
    lastPreviewIdRef.current = newestPreviewId
  }, [minimized, newestPreviewId])

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
                  title={`Mostra/amaga ${level} · ⌘/Ctrl+clic per veure'n només aquest`}
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
                className={`dev-console__action-btn dev-console__action-btn--icon${scrollLocked ? ' dev-console__action-btn--on' : ''}`}
                onClick={toggleScrollLock}
                title={scrollLocked ? 'Desbloqueja el scroll automàtic' : 'Bloqueja el scroll automàtic'}
                aria-pressed={scrollLocked}
                aria-label={scrollLocked ? 'Desbloqueja el scroll automàtic' : 'Bloqueja el scroll automàtic'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </button>
              <button
                className="dev-console__action-btn dev-console__action-btn--icon"
                onClick={copyAll}
                title="Copia els logs al portapapers"
                aria-label="Copia els logs al portapapers"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                  />
                </svg>
              </button>
              <button
                className="dev-console__action-btn dev-console__action-btn--text-icon"
                onClick={clear}
                title="Esborra els logs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z"
                  />
                </svg>
                Clear
              </button>
              <button
                className="dev-console__action-btn dev-console__action-btn--icon"
                onClick={hide}
                title="Tanca la consola"
                aria-label="Tanca"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Minimized preview: últimes entrades amb efecte teletip. El contenidor
          extern retalla (overflow:hidden) i el `__preview-track` intern és qui
          llisca: en arribar una entrada nova, `key={enteringId}` el remunta i el
          `@keyframes` el desplaça des d'una alçada de línia amunt fins a la seva
          posició, així tot el bloc es mou junt i la línia de dalt surt per la
          vora. El modificador de direcció fixa des d'on entra la línia nova; avui
          les més recents van a baix (llisca amunt). Quan l'ordenació sigui
          configurable, només cal commutar aquest modificador. */}
      {minimized && previewSlice.length > 0 && (
        <div
          className="dev-console__preview dev-console__preview--newest-bottom"
          aria-hidden="true"
        >
          <div className="dev-console__preview-track" key={enteringId ?? 'init'}>
            {previewSlice.map((entry) => (
              <div
                key={entry.id}
                className={`dev-console__line dev-console__line--${entry.level}`}
              >
                <span className="dev-console__ts">{formatTime(entry.ts)}</span>
                <span className={`dev-console__badge dev-console__badge--${entry.level}`}>
                  {entry.level}
                </span>
                <span className="dev-console__msg dev-console__msg--collapsed">
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
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
            <LogLine key={entry.id} entry={entry} minimized={minimized} />
          ))
        )}
      </div>
    </div>
  )
}
