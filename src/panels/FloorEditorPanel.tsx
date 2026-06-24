import { lazy, Suspense, useMemo } from 'react'
import { useMiradorData } from '../api/mirador-data-context'
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

export function FloorEditorPanel() {
  const { agents, queues } = useMiradorData()
  const fp = useFloorPlan()
  // The canvas and the floor list scroll inside the editor (not the panel
  // shell), so each gets its own Lenis instance for smooth wheel scrolling.
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const asideScrollRef = useSmoothScroll<HTMLDivElement>()

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

  return (
    <PanelShell hideHeader smoothScroll={false} className="panel-shell--floor">
      <div className="floor-editor">
        <aside className="floor-editor__aside">
          <div className="floor-editor__aside-scroll" ref={asideScrollRef}>
            <FloorSidebar
              places={fp.places}
              activePlace={fp.activePlace}
              activeFloorIndex={fp.activeFloorIndex}
              activeFloor={fp.activeFloor}
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
              onChangeBackground={fp.changeBackground}
              onChangeBackgroundOpacity={fp.changeBackgroundOpacity}
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
