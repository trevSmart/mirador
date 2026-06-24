/* EXPERIMENTAL — Dev tab. A throwaway replica of the Floor panel that renders
   the 3D view through the vectorial projection in `src/dev/`, with azimuth and
   tilt sliders so we can see whether a dimetric angle breaks tower occlusion.
   Registered with a single experimental line in `panels/registry.ts`. Remove
   that line + delete `src/dev/` and this DevPanel to drop the experiment. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMiradorData } from '../api/mirador-data-context'
import type { Agent, PresenceStatus } from '../api/types'
import { FloorZoomControl } from '../components/floor/FloorZoomControl'
import { FLOOR_ZOOM_KEY, adjustFloorZoomFromWheel, loadFloorZoom } from '../components/floor/floor-zoom'
import { PanelShell } from '../components/PanelState'
import { Select } from '../components/ds/Select'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useFloorPlanData } from '../floor/useFloorPlanData'
import { setFloorSeatedAgentIds } from '../floor/floor-seated-agents'
import { useSmoothScroll } from '../hooks/useSmoothScroll'
import { usePreferences } from '../settings/preferences-context'
import { presenceLabel } from '../utils/format'
import type { Floor } from '../floor/types'
import { FloorView3DVec } from './FloorView3DVec'
import { makeBasis } from './floor-iso-vec'

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const AZIMUTH_DEFAULT = 45
const TILT_DEFAULT = 0.5

export function DevPanel() {
  const { data, loaded } = useFloorPlanData()
  const { agents, queues } = useMiradorData()
  const { openAgent } = useDetailDrawer()
  const { prefs, save } = usePreferences()
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(loadFloorZoom)
  const [azimuth, setAzimuth] = useState<number>(AZIMUTH_DEFAULT)
  const [tilt, setTilt] = useState<number>(TILT_DEFAULT)

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
      element.addEventListener('wheel', onWheel, { passive: false, capture: true })
      wheelCleanupRef.current = () => element.removeEventListener('wheel', onWheel)
    },
    [canvasScrollRef],
  )

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
  const basis = useMemo(() => makeBasis(azimuth, tilt), [azimuth, tilt])

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

  const handleSelectAgent = (agent: Agent) => openAgent(agent.id)

  const renderFloorTile = (floor: Floor) => (
    <section key={floor.id} className="fv-stack__item">
      {multiFloor ? <h4 className="fv-stack__label">{floor.name}</h4> : null}
      <div className="fv-stack__render">
        <FloorView3DVec
          floor={floor}
          agentsById={agentsById}
          queuesById={queuesById}
          basis={basis}
          showAvatars={prefs.showAvatars}
          animations={prefs.animations}
          onSelectAgent={handleSelectAgent}
        />
      </div>
    </section>
  )

  const floorStack = (
    <div className={`fv-stack${multiFloor ? ' fv-stack--multi' : ' fv-stack--single'}`} style={stackStyle}>
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
            {!multiFloor ? <span className="fv-floor-name">{floors[0]!.name}</span> : null}
            <span className="fv-place-name" style={{ opacity: 0.6 }}>· experiment vectorial</span>
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

            <label className="fv-stat" title="Azimut de la projecció (45° = isomètric clàssic)" style={{ gap: 6 }}>
              Azimut
              <input type="range" min={30} max={60} step={1} value={azimuth} onChange={(e) => setAzimuth(Number(e.target.value))} />
              <span style={{ width: 34, textAlign: 'right' }}>{azimuth}°</span>
            </label>

            <label className="fv-stat" title="Inclinació vertical (0.5 = 2:1 isomètric)" style={{ gap: 6 }}>
              Inclinació
              <input type="range" min={0.35} max={0.7} step={0.01} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} />
              <span style={{ width: 34, textAlign: 'right' }}>{tilt.toFixed(2)}</span>
            </label>

            <button
              type="button"
              className="fv-toggle__btn"
              onClick={() => {
                setAzimuth(AZIMUTH_DEFAULT)
                setTilt(TILT_DEFAULT)
              }}
            >
              Reset
            </button>

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

            <FloorZoomControl zoom={zoom} onChange={setZoom} />
          </div>
        </header>

        <div className="fv-canvas" ref={setCanvasRef}>
          {floorStack}
        </div>
      </div>
    </PanelShell>
  )
}
