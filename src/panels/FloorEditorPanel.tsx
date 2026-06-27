import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import { AgentAssignPalette } from '../components/floor/AgentAssignPalette'
import { FloorGrid } from '../components/floor/FloorGrid'
import { FloorSidebar } from '../components/floor/FloorSidebar'
import { FloorToolbar } from '../components/floor/FloorToolbar'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'
import { PanelShell } from '../components/PanelState'

const FloorView3D = lazy(() =>
  import('../components/floor/FloorView3D').then(m => ({ default: m.FloorView3D }))
)
import { useFloorPlan } from '../floor/useFloorPlan'
import { useSmoothScroll } from '../hooks/useSmoothScroll'

/** The editor preview is display-only; seat taps do nothing there. */
const noop = () => {}

const SPLIT_KEY = 'mirador.floor-editor.split'
const MIN_SPLIT = 0.25
const MAX_SPLIT = 0.75

/** Left-column (aside) fraction (0..1) persisted between sessions. */
function loadSplit(): number {
  try {
    const raw = localStorage.getItem(SPLIT_KEY)
    if (raw) {
      const value = Number.parseFloat(raw)
      if (Number.isFinite(value)) return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value))
    }
  } catch {
    /* ignore */
  }
  return 0.3
}

export function FloorEditorPanel() {
  const agents = useAgents()
  const queues = useQueues()
  const fp = useFloorPlan()
  // The canvas and the floor list scroll inside the editor (not the panel
  // shell), so each gets its own Lenis instance for smooth wheel scrolling.
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const asideScrollRef = useSmoothScroll<HTMLDivElement>()

  const layoutRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<number>(loadSplit)

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    const layout = layoutRef.current
    if (!layout) return

    const onMove = (move: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const fraction = (move.clientX - rect.left) / rect.width
      setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSplit((current) => {
        try {
          localStorage.setItem(SPLIT_KEY, String(current))
        } catch {
          /* ignore */
        }
        return current
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const queuesById = useMemo(() => new Map(queues.map((queue) => [queue.id, queue])), [queues])

  const placedAgentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const seat of fp.activeFloor?.seats ?? []) {
      if (seat.agentId) ids.add(seat.agentId)
    }
    return ids
  }, [fp.activeFloor])

  const selectedSeatAgentId = useMemo(() => {
    if (!fp.selectedSeat || !fp.activeFloor) return null
    const seat = fp.activeFloor.seats.find(
      (s) => s.c === fp.selectedSeat?.c && s.r === fp.selectedSeat?.r,
    )
    return seat?.agentId ?? null
  }, [fp.selectedSeat, fp.activeFloor])

  if (!fp.loaded) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
        <p className="panel-state panel-state--muted">Carregant plànol…</p>
      </PanelShell>
    )
  }

  // Single CSS var drives the left column; the right stays at 1fr, so the
  // ratio is split / (1 - split). The media query can still override cleanly.
  const layoutStyle = {
    ['--fe-split']: `${split / (1 - split)}fr`,
  } as React.CSSProperties

  return (
    <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
      <div className="floor-editor" ref={layoutRef} style={layoutStyle}>
        <aside className="floor-editor__aside">
          <div className="floor-editor__aside-scroll" ref={asideScrollRef}>
            <FloorSidebar
              places={fp.places}
              activePlace={fp.activePlace}
              activeFloorIndex={fp.activeFloorIndex}
              onSelectPlace={fp.selectPlace}
              onAddPlace={fp.addPlace}
              onRemovePlace={fp.removePlace}
              onRenamePlace={fp.renamePlace}
              onSelectFloor={fp.selectFloor}
              onAddFloor={fp.addFloor}
              onRemoveFloor={fp.removeFloor}
              onDuplicateFloor={fp.duplicateFloor}
              onRenameFloor={fp.renameFloor}
              onReorderFloor={fp.reorderFloor}
            />
            {fp.tool === 'seat' && fp.selectedSeat ? (
              <AgentAssignPalette
                seat={fp.selectedSeat}
                currentAgentId={selectedSeatAgentId}
                agents={agents}
                placedAgentIds={placedAgentIds}
                onAssign={fp.assignAgent}
                onRemoveSeat={fp.removeSeat}
              />
            ) : null}
          </div>
          {fp.activeFloor && fp.activeFloor.cells.length > 0 ? (
            <div className="floor-editor__preview" aria-label="Previsualització de la sala">
              <Suspense fallback={<PanelSuspenseFallback />}>
                <FloorView3D
                  floor={fp.activeFloor}
                  agentsById={agentsById}
                  queuesById={queuesById}
                  dir={fp.activeFloor.dir}
                  seatStyle="tower"
                  showAvatars
                  animations={false}
                  onSelectAgent={noop}
                />
              </Suspense>
            </div>
          ) : null}
        </aside>

        <div
          className="floor-editor__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajusta la proporció de les columnes"
          onPointerDown={startResize}
        >
          <span className="floor-editor__resizer-grip" aria-hidden="true" />
        </div>

        <div className="floor-editor__main">
          <FloorToolbar
            tool={fp.tool}
            floor={fp.activeFloor}
            dirty={fp.dirty}
            canUndo={fp.canUndo}
            canRedo={fp.canRedo}
            onSelectTool={fp.setTool}
            onRotate={fp.rotateFloor}
            onUndo={fp.undo}
            onRedo={fp.redo}
            onSave={fp.save}
            onReset={fp.reset}
          />
          <div className="floor-editor__canvas" ref={canvasScrollRef}>
            {fp.activeFloor ? (
              <FloorGrid
                floor={fp.activeFloor}
                tool={fp.tool}
                selectedSeat={fp.selectedSeat}
                agentsById={agentsById}
                onPaintCells={fp.paintCellRect}
                onEraseCell={fp.eraseCellAt}
                onSeatTap={fp.seatAt}
                onEdgeTap={fp.applyEdge}
              />
            ) : (
              <p className="panel-state panel-state--muted">Aquesta planta no té cap cel·la.</p>
            )}
          </div>
        </div>
      </div>
    </PanelShell>
  )
}
