import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import type { Agent, PresenceStatus } from '../api/types'
import { FloorView } from '../components/floor/FloorView'
import { FloorZoomControl } from '../components/floor/FloorZoomControl'
import { FLOOR_ZOOM_KEY, adjustFloorZoomFromWheel, loadFloorZoom } from '../components/floor/floor-zoom'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'
import { PanelShell } from '../components/PanelState'
import { Select } from '../components/ds/Select'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useFloorPlanData } from '../floor/useFloorPlanData'
import { setFloorSeatedAgentIds } from '../floor/floor-seated-agents'
import { useSmoothScroll } from '../hooks/useSmoothScroll'
import { usePreferences } from '../settings/preferences-context'
import { presenceLabel } from '../utils/format'
import type { Floor } from '../floor/types'

const FloorView3D = lazy(() =>
  import('../components/floor/FloorView3D').then(m => ({ default: m.FloorView3D }))
)

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

type ViewMode = '2d' | '3d'

export function FloorPanel() {
  const { data, loaded } = useFloorPlanData()
  const agents = useAgents()
  const queues = useQueues()
  const { openAgent } = useDetailDrawer()
  const { prefs, save } = usePreferences()
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(loadFloorZoom)

  const setCanvasRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (wheelCleanupRef.current) {
        wheelCleanupRef.current()
        wheelCleanupRef.current = null
      }
      canvasScrollRef(element)
      if (!element) return

      const onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        event.stopImmediatePropagation()
        setZoom((current) => adjustFloorZoomFromWheel(current, event.deltaY))
      }

      // Removal must repeat the capture flag, otherwise it's a no-op and the
      // listener (plus its closure) leaks on every ref change / remount.
      element.addEventListener('wheel', onWheel, { passive: false, capture: true })
      wheelCleanupRef.current = () =>
        element.removeEventListener('wheel', onWheel, { capture: true })
    },
    [canvasScrollRef],
  )

  // The view follows the user's default (Settings → Aparença). Changing the
  // preference re-syncs the live view, even though Dockview keeps this panel
  // mounted — handled by adjusting state during render when the default changes.
  // A manual toggle here still wins until the default preference changes again.
  const [view, setView] = useState<ViewMode>(prefs.defaultFloorView)
  const [prevDefault, setPrevDefault] = useState<ViewMode>(prefs.defaultFloorView)
  if (prevDefault !== prefs.defaultFloorView) {
    setPrevDefault(prefs.defaultFloorView)
    setView(prefs.defaultFloorView)
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(FLOOR_ZOOM_KEY, String(zoom))
      } catch {
        /* ignore */
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [zoom])

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const queuesById = useMemo(() => new Map(queues.map((queue) => [queue.id, queue])), [queues])

  const activePlace = useMemo(() => {
    if (!data || data.places.length === 0) return null
    return data.places.find((p) => p.id === placeId) ?? data.places[0]
  }, [data, placeId])

  const floors = useMemo(() => activePlace?.floors ?? [], [activePlace])
  const multiFloor = floors.length > 1

  const stackStyle = {
    '--fv-zoom': zoom,
    '--fv-render-zoom': zoom,
  } as React.CSSProperties

  useEffect(() => {
    const ids = new Set<string>()
    for (const floor of floors) {
      for (const seat of floor.seats) {
        if (seat.agentId) ids.add(seat.agentId)
      }
    }
    setFloorSeatedAgentIds(ids)
  }, [floors])

  const summary = useMemo(() => {
    const counts: Record<PresenceStatus, number> = { online: 0, busy: 0, away: 0, offline: 0 }
    let vacant = 0
    let total = 0
    for (const floor of floors) {
      for (const seat of floor.seats) {
        total += 1
        const agent = seat.agentId ? agentsById.get(seat.agentId) : null
        if (agent) counts[agent.status] += 1
        else vacant += 1
      }
    }
    return { counts, vacant, total }
  }, [floors, agentsById])

  const handleSelectAgent = (agent: Agent) => {
    openAgent(agent.id)
  }

  const renderFloorTile = (floor: Floor) => (
    <section key={floor.id} className="fv-stack__item">
      {multiFloor ? <h4 className="fv-stack__label">{floor.name}</h4> : null}
      <div className="fv-stack__render">
        {view === '3d' ? (
          <FloorView3D
            floor={floor}
            agentsById={agentsById}
            queuesById={queuesById}
            showAvatars={prefs.showAvatars}
            animations={prefs.animations}
            onSelectAgent={handleSelectAgent}
          />
        ) : (
          <FloorView
            floor={floor}
            dir={floor.dir}
            agentsById={agentsById}
            showAvatars={prefs.showAvatars}
            animations={prefs.animations}
            onSelectAgent={handleSelectAgent}
          />
        )}
      </div>
    </section>
  )

  const floorStack = (
    <div
      className={`fv-stack${multiFloor ? ' fv-stack--multi' : ' fv-stack--single'}`}
      style={stackStyle}
    >
      {floors.map(renderFloorTile)}
    </div>
  )

  if (!loaded) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
        <p className="panel-state panel-state--muted">Carregant plànol…</p>
      </PanelShell>
    )
  }

  if (!data || !activePlace || floors.length === 0) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
        <p className="panel-state panel-state--muted">
          Encara no hi ha cap plànol desat. Crea'l des del panell <strong>Floor editor</strong>.
        </p>
      </PanelShell>
    )
  }

  return (
    <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
      <div className="floor-view">
        <header className="fv-bar">
          <div className="fv-selectors">
            {data.places.length > 1 ? (
              <Select
                className="fv-select"
                ariaLabel="Lloc"
                value={activePlace.id}
                options={data.places.map((place) => ({ value: place.id, label: place.name }))}
                onChange={(id) => setPlaceId(id)}
              />
            ) : (
              <span className="fv-place-name">{activePlace.name}</span>
            )}

            {!multiFloor ? <span className="fv-floor-name">{floors[0].name}</span> : null}
          </div>

          <div className="fv-controls">
            <div className="fv-summary">
              {STATUS_ORDER.map((status) => (
                <span key={status} className="fv-stat" title={presenceLabel(status)}>
                  <span className="fv-stat__dot" style={{ background: STATUS_DOT[status] }} />
                  {summary.counts[status]}
                </span>
              ))}
              <span className="fv-stat fv-stat--vacant" title="Seients lliures">
                {summary.vacant} lliures
              </span>
            </div>

            <FloorZoomControl zoom={zoom} onChange={setZoom} />

            <div className="fv-toggle" role="group" aria-label="Avatars">
              <button
                type="button"
                className={`fv-toggle__btn${prefs.showAvatars ? ' fv-toggle__btn--on' : ''}`}
                onClick={() => save({ ...prefs, showAvatars: !prefs.showAvatars })}
                aria-pressed={prefs.showAvatars}
                title="Mostra els avatars dels agents sobre les torres"
              >
                Avatars
              </button>
            </div>

            <div className="fv-toggle" role="group" aria-label="Vista">
              <button
                type="button"
                className={`fv-toggle__btn${view === '2d' ? ' fv-toggle__btn--on' : ''}`}
                onClick={() => setView('2d')}
              >
                2D
              </button>
              <button
                type="button"
                className={`fv-toggle__btn${view === '3d' ? ' fv-toggle__btn--on' : ''}`}
                onClick={() => setView('3d')}
              >
                3D
              </button>
            </div>
          </div>
        </header>

        <div className="fv-canvas" ref={setCanvasRef}>
          {view === '3d' ? (
            <Suspense fallback={<PanelSuspenseFallback />}>{floorStack}</Suspense>
          ) : (
            floorStack
          )}
        </div>
      </div>
    </PanelShell>
  )
}
