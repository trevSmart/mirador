/* EXPERIMENTAL — Dev tab. A throwaway replica of the Floor panel that renders
   the 3D view through the vectorial projection in `src/dev/`. Each room (floor)
   has its own perspective rotation, draggable on the render and persisted in
   localStorage. Registered with a single experimental line in
   `panels/registry.ts`. Remove that line + delete `src/dev/` to drop it. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import type { Agent, Queue, PresenceStatus } from '../api/types'
import { FloorZoomControl } from '../components/floor/FloorZoomControl'
import { DEV_ZOOM_KEY, DEV_ZOOM_MAX, DEV_ZOOM_MIN, adjustDevZoomFromWheel, loadDevZoom } from './dev-zoom'
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
import {
  type RoomRotation,
  ROOM_AZ_DEFAULT,
  ROOM_AZ_MAX,
  ROOM_AZ_MIN,
  ROOM_TILT_DEFAULT,
  ROOM_TILT_MAX,
  ROOM_TILT_MIN,
  defaultRotation,
  loadRoomRotations,
  saveRoomRotations,
} from './floor-rotation-store'

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

// Drag sensitivity (degrees / px and tilt-units / px) + click-vs-drag threshold.
const DRAG_AZ_PER_PX = 0.25
const DRAG_TILT_PER_PX = 0.0018
const DRAG_THRESHOLD = 3

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

interface RoomRenderProps {
  floor: Floor
  rotation: RoomRotation
  onRotate: (next: RoomRotation) => void
  onFocus: (floorId: string) => void
  multiFloor: boolean
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
}

/** One room: owns its own drag-to-orbit gesture, rotating only this floor. */
function RoomRender({
  floor,
  rotation,
  onRotate,
  onFocus,
  multiFloor,
  agentsById,
  queuesById,
  showAvatars,
  animations,
  onSelectAgent,
}: RoomRenderProps) {
  const [dragging, setDragging] = useState(false)
  // Pointer origin + the az/tilt captured at press. `active` only flips once the
  // pointer moves past a threshold, so plain clicks (selecting a tower) are never
  // swallowed by the orbit capture.
  const orbitRef = useRef<{ x: number; y: number; az: number; tilt: number; active: boolean } | null>(null)

  const basis = useMemo(() => makeBasis(rotation.az, rotation.tilt), [rotation.az, rotation.tilt])

  const onDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      onFocus(floor.id)
      orbitRef.current = { x: event.clientX, y: event.clientY, az: rotation.az, tilt: rotation.tilt, active: false }
    },
    [floor.id, onFocus, rotation.az, rotation.tilt],
  )

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = orbitRef.current
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!start.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        start.active = true
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      // Horizontal → azimuth (orbit around), vertical → tilt (drag down = flatter).
      onRotate({
        az: clamp(start.az - dx * DRAG_AZ_PER_PX, ROOM_AZ_MIN, ROOM_AZ_MAX),
        tilt: clamp(start.tilt + dy * DRAG_TILT_PER_PX, ROOM_TILT_MIN, ROOM_TILT_MAX),
      })
    },
    [onRotate],
  )

  const onUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = orbitRef.current
    orbitRef.current = null
    setDragging(false)
    if (start?.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return (
    <section className="fv-stack__item">
      {multiFloor ? <h4 className="fv-stack__label">{floor.name}</h4> : null}
      <div
        className="fv-stack__render"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <FloorView3DVec
          floor={floor}
          agentsById={agentsById}
          queuesById={queuesById}
          basis={basis}
          showAvatars={showAvatars}
          animations={animations}
          onSelectAgent={onSelectAgent}
        />
      </div>
    </section>
  )
}

export function DevPanel() {
  const { data, loaded } = useFloorPlanData()
  const agents = useAgents()
  const queues = useQueues()
  const { openAgent } = useDetailDrawer()
  const { prefs, save } = usePreferences()
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const wheelCleanupRef = useRef<(() => void) | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(loadDevZoom)
  // Per-room rotation, keyed by floor id, hydrated from + persisted to localStorage.
  const [rotations, setRotations] = useState<Record<string, RoomRotation>>(loadRoomRotations)
  // Which room the toolbar sliders act on (defaults to the first floor).
  const [focusedId, setFocusedId] = useState<string | null>(null)

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
        setZoom((current) => adjustDevZoomFromWheel(current, event.deltaY))
      }
      element.addEventListener('wheel', onWheel, { passive: false, capture: true })
      wheelCleanupRef.current = () => element.removeEventListener('wheel', onWheel)
    },
    [canvasScrollRef],
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(DEV_ZOOM_KEY, String(zoom))
      } catch {
        /* ignore */
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [zoom])

  // Persist room rotations (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => saveRoomRotations(rotations), 250)
    return () => window.clearTimeout(id)
  }, [rotations])

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const queuesById = useMemo(() => new Map(queues.map((queue) => [queue.id, queue])), [queues])

  const activePlace = useMemo(() => {
    if (!data || data.places.length === 0) return null
    return data.places.find((p) => p.id === placeId) ?? data.places[0]
  }, [data, placeId])

  const floors = useMemo(() => activePlace?.floors ?? [], [activePlace])
  const multiFloor = floors.length > 1

  const getRotation = useCallback(
    (floorId: string): RoomRotation => rotations[floorId] ?? defaultRotation(),
    [rotations],
  )
  const setRotation = useCallback((floorId: string, next: RoomRotation) => {
    setRotations((prev) => ({ ...prev, [floorId]: next }))
  }, [])

  const focusedFloor = useMemo(
    () => floors.find((f) => f.id === focusedId) ?? floors[0] ?? null,
    [floors, focusedId],
  )

  const stackStyle = {
    '--fv-zoom': zoom,
    '--fv-render-zoom': zoom,
    // Centre each room horizontally in the rooms container (overrides the shared
    // .fv-stack flex-start without touching the official CSS).
    justifyContent: 'center',
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

  const handleSelectAgent = useCallback((agent: Agent) => openAgent(agent.id), [openAgent])

  const floorStack = (
    <div className={`fv-stack${multiFloor ? ' fv-stack--multi' : ' fv-stack--single'}`} style={stackStyle}>
      {floors.map((floor) => (
        <RoomRender
          key={floor.id}
          floor={floor}
          rotation={getRotation(floor.id)}
          onRotate={(next) => setRotation(floor.id, next)}
          onFocus={setFocusedId}
          multiFloor={multiFloor}
          agentsById={agentsById}
          queuesById={queuesById}
          showAvatars={prefs.showAvatars}
          animations={prefs.animations}
          onSelectAgent={handleSelectAgent}
        />
      ))}
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

  const focusedRotation = focusedFloor ? getRotation(focusedFloor.id) : defaultRotation()

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

            {multiFloor && focusedFloor ? (
              <span className="fv-floor-name" title="Sala que controlen els sliders">{focusedFloor.name}</span>
            ) : null}

            <label className="fv-stat" title="Azimut de la projecció (45° = isomètric clàssic). També: arrossega el render en horitzontal." style={{ gap: 6 }}>
              Azimut
              <input
                type="range"
                min={ROOM_AZ_MIN}
                max={ROOM_AZ_MAX}
                step={1}
                value={Math.round(focusedRotation.az)}
                onChange={(e) => focusedFloor && setRotation(focusedFloor.id, { ...focusedRotation, az: Number(e.target.value) })}
              />
              <span style={{ width: 34, textAlign: 'right' }}>{Math.round(focusedRotation.az)}°</span>
            </label>

            <label className="fv-stat" title="Inclinació vertical (0.5 = 2:1 isomètric). També: arrossega el render en vertical." style={{ gap: 6 }}>
              Inclinació
              <input
                type="range"
                min={ROOM_TILT_MIN}
                max={ROOM_TILT_MAX}
                step={0.01}
                value={focusedRotation.tilt}
                onChange={(e) => focusedFloor && setRotation(focusedFloor.id, { ...focusedRotation, tilt: Number(e.target.value) })}
              />
              <span style={{ width: 34, textAlign: 'right' }}>{focusedRotation.tilt.toFixed(2)}</span>
            </label>

            <button
              type="button"
              className="fv-toggle__btn"
              title={multiFloor ? 'Reinicia la rotació de la sala seleccionada' : 'Reinicia la rotació'}
              onClick={() => focusedFloor && setRotation(focusedFloor.id, { az: ROOM_AZ_DEFAULT, tilt: ROOM_TILT_DEFAULT })}
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

            <FloorZoomControl zoom={zoom} onChange={setZoom} minZoom={DEV_ZOOM_MIN} maxZoom={DEV_ZOOM_MAX} />
          </div>
        </header>

        <div className="fv-canvas" ref={setCanvasRef}>
          {floorStack}
        </div>
      </div>
    </PanelShell>
  )
}
