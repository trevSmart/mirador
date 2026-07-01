import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import type { Agent, PresenceStatus } from '../api/types'
import { SpaceView } from '../components/space/SpaceView'
import { SpaceZoomControl } from '../components/space/SpaceZoomControl'
import { SPACE_ZOOM_KEY, adjustSpaceZoomFromWheel, loadSpaceZoom } from '../components/space/space-zoom'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'
import { PanelShell } from '../components/PanelState'
import { Select } from '../components/ds/Select'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useSpacePlanData } from '../space/useSpacePlanData'
import { visiblePlaces, visibleSpaces } from '../space/space-plan-model'
import { useSmoothScroll } from '../hooks/useSmoothScroll'
import { usePreferences } from '../settings/preferences-context'
import { presenceLabel } from '../utils/format'
import type { Space } from '../space/types'

const SpaceView3D = lazy(() =>
  import('../components/space/SpaceView3D').then(m => ({ default: m.SpaceView3D }))
)

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

type ViewMode = '2d' | '3d'

export function SpacePanel() {
  const { data, loaded } = useSpacePlanData()
  const agents = useAgents()
  const queues = useQueues()
  const { openAgent } = useDetailDrawer()
  const { prefs, save } = usePreferences()
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(loadSpaceZoom)

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
        setZoom((current) => adjustSpaceZoomFromWheel(current, event.deltaY))
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
  const [view, setView] = useState<ViewMode>(prefs.defaultSpaceView)
  const [prevDefault, setPrevDefault] = useState<ViewMode>(prefs.defaultSpaceView)
  if (prevDefault !== prefs.defaultSpaceView) {
    setPrevDefault(prefs.defaultSpaceView)
    setView(prefs.defaultSpaceView)
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(SPACE_ZOOM_KEY, String(zoom))
      } catch {
        /* ignore */
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [zoom])

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const queuesById = useMemo(() => new Map(queues.map((queue) => [queue.id, queue])), [queues])

  // Live views hide anything inactive or hanging off something inactive.
  const allPlaces = useMemo(() => (data ? visiblePlaces(data) : []), [data])
  const activePlace = useMemo(() => {
    if (allPlaces.length === 0) return null
    return allPlaces.find((p) => p.id === placeId) ?? allPlaces[0]
  }, [allPlaces, placeId])

  const spaces = useMemo(() => (activePlace ? visibleSpaces(activePlace) : []), [activePlace])
  const multiSpace = spaces.length > 1

  const stackStyle = {
    '--fv-zoom': zoom,
    '--fv-render-zoom': zoom,
  } as React.CSSProperties

  const summary = useMemo(() => {
    const counts: Record<PresenceStatus, number> = { online: 0, busy: 0, away: 0, offline: 0 }
    let vacant = 0
    let total = 0
    for (const space of spaces) {
      for (const seat of space.seats) {
        total += 1
        const agent = seat.agentId ? agentsById.get(seat.agentId) : null
        if (agent) counts[agent.status] += 1
        else vacant += 1
      }
    }
    return { counts, vacant, total }
  }, [spaces, agentsById])

  const handleSelectAgent = (agent: Agent) => {
    openAgent(agent.id)
  }

  const renderSpaceTile = (space: Space) => (
    <section key={space.id} className="fv-stack__item">
      {multiSpace ? <h4 className="fv-stack__label">{space.name}</h4> : null}
      <div className="fv-stack__render">
        {view === '3d' ? (
          <SpaceView3D
            space={space}
            agentsById={agentsById}
            queuesById={queuesById}
            showAvatars={prefs.showAvatars}
            animations={prefs.animations}
            onSelectAgent={handleSelectAgent}
          />
        ) : (
          <SpaceView
            space={space}
            dir={space.dir}
            agentsById={agentsById}
            showAvatars={prefs.showAvatars}
            animations={prefs.animations}
            onSelectAgent={handleSelectAgent}
          />
        )}
      </div>
    </section>
  )

  const spaceStack = (
    <div
      className={`fv-stack${multiSpace ? ' fv-stack--multi' : ' fv-stack--single'}`}
      style={stackStyle}
    >
      {spaces.map(renderSpaceTile)}
    </div>
  )

  if (!loaded) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--space">
        <p className="panel-state panel-state--muted">Carregant plànol…</p>
      </PanelShell>
    )
  }

  if (!data || !activePlace || spaces.length === 0) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--space">
        <p className="panel-state panel-state--muted">
          Encara no hi ha cap plànol desat. Crea'l des del panell <strong>Space editor</strong>.
        </p>
      </PanelShell>
    )
  }

  return (
    <PanelShell hideHeader smoothScroll={false} className="panel-shell--space">
      <div className="space-view">
        <header className="fv-bar">
          <div className="fv-selectors">
            {allPlaces.length > 1 ? (
              <Select
                className="fv-select"
                ariaLabel="Lloc"
                value={activePlace.id}
                options={allPlaces.map((place) => ({ value: place.id, label: place.name }))}
                onChange={(id) => setPlaceId(id)}
              />
            ) : (
              <span className="fv-place-name">{activePlace.name}</span>
            )}

            {!multiSpace ? <span className="fv-space-name">{spaces[0].name}</span> : null}
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

            <SpaceZoomControl zoom={zoom} onChange={setZoom} />

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
            <Suspense fallback={<PanelSuspenseFallback />}>{spaceStack}</Suspense>
          ) : (
            spaceStack
          )}
        </div>
      </div>
    </PanelShell>
  )
}
