import { useMemo } from 'react'
import { useMiradorData } from '../api/MiradorDataProvider'
import { AgentAssignPalette } from '../components/floor/AgentAssignPalette'
import { FloorGrid } from '../components/floor/FloorGrid'
import { FloorSidebar } from '../components/floor/FloorSidebar'
import { FloorToolbar } from '../components/floor/FloorToolbar'
import { PanelShell } from '../components/PanelState'
import { useFloorPlan } from '../floor/useFloorPlan'

export function FloorEditorPanel() {
  const { agents } = useMiradorData()
  const fp = useFloorPlan()

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])

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
      <PanelShell hideHeader className="panel-shell--floor">
        <p className="panel-state panel-state--muted">Carregant plànol…</p>
      </PanelShell>
    )
  }

  return (
    <PanelShell hideHeader className="panel-shell--floor">
      <div className="floor-editor">
        <div className="floor-editor__main">
          <FloorToolbar
            tool={fp.tool}
            floor={fp.activeFloor}
            dirty={fp.dirty}
            canUndo={fp.canUndo}
            canRedo={fp.canRedo}
            onSelectTool={fp.setTool}
            onUndo={fp.undo}
            onRedo={fp.redo}
            onSave={fp.save}
            onReset={fp.reset}
          />
          <div className="floor-editor__canvas">
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

        <aside className="floor-editor__aside">
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
        </aside>
      </div>
    </PanelShell>
  )
}
