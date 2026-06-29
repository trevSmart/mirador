import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import { AgentAssignPalette } from '../components/space/AgentAssignPalette'
import { SpaceGrid } from '../components/space/SpaceGrid'
import { SpaceSidebar } from '../components/space/SpaceSidebar'
import { SpacePlanTree } from '../components/space/SpacePlanTree'
import { SpaceToolbar } from '../components/space/SpaceToolbar'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'
import { PanelShell } from '../components/PanelState'

const SpaceView3D = lazy(() =>
  import('../components/space/SpaceView3D').then(m => ({ default: m.SpaceView3D }))
)
import { useSpacePlan } from '../space/useSpacePlan'
import { useSmoothScroll } from '../hooks/useSmoothScroll'

/** The editor preview is display-only; seat taps do nothing there. */
const noop = () => {}

const SPLIT_KEY = 'mirador.space-editor.split'
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

export function SpaceEditorPanel() {
  const agents = useAgents()
  const queues = useQueues()
  const fp = useSpacePlan()
  // The canvas and the space list scroll inside the editor (not the panel
  // shell), so each gets its own Lenis instance for smooth wheel scrolling.
  const canvasScrollRef = useSmoothScroll<HTMLDivElement>()
  const asideScrollRef = useSmoothScroll<HTMLDivElement>()

  const layoutRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [split, setSplit] = useState<number>(loadSplit)

  const openImportDialog = useCallback(() => {
    fp.clearImportError()
    importInputRef.current?.click()
  }, [fp])

  const onImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Reset the input so re-selecting the same file fires change again.
      event.target.value = ''
      if (file) void fp.importJson(file)
    },
    [fp],
  )

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
    for (const seat of fp.activeSpace?.seats ?? []) {
      if (seat.agentId) ids.add(seat.agentId)
    }
    return ids
  }, [fp.activeSpace])

  const selectedSeatAgentId = useMemo(() => {
    if (!fp.selectedSeat || !fp.activeSpace) return null
    const seat = fp.activeSpace.seats.find(
      (s) => s.c === fp.selectedSeat?.c && s.r === fp.selectedSeat?.r,
    )
    return seat?.agentId ?? null
  }, [fp.selectedSeat, fp.activeSpace])

  if (!fp.loaded) {
    return (
      <PanelShell hideHeader smoothScroll={false} className="panel-shell--space">
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
    <PanelShell hideHeader smoothScroll={false} className="panel-shell--space">
      <div className="space-editor" ref={layoutRef} style={layoutStyle}>
        <aside className="space-editor__aside">
          <div className="space-editor__aside-scroll" ref={asideScrollRef}>
            <SpaceSidebar
              places={fp.places}
              activePlace={fp.activePlace}
              activeSpaceIndex={fp.activeSpaceIndex}
              onSelectPlace={fp.selectPlace}
              onAddPlace={fp.addPlace}
              onRemovePlace={fp.removePlace}
              onRenamePlace={fp.renamePlace}
              onSelectSpace={fp.selectSpace}
              onAddSpace={fp.addSpace}
              onRemoveSpace={fp.removeSpace}
              onDuplicateSpace={fp.duplicateSpace}
              onRenameSpace={fp.renameSpace}
              onReorderSpace={fp.reorderSpace}
              onExport={fp.exportJson}
              onImport={openImportDialog}
            />
            <hr className="space-editor__plan-tree-divider" />
            <SpacePlanTree places={fp.places} agentsById={agentsById} queuesById={queuesById} />
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={onImportFileChange}
            />
            {fp.importError ? (
              <div className="space-editor__save-error" role="alert">
                No s'ha pogut importar: {fp.importError}
              </div>
            ) : null}
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
          {fp.activeSpace && fp.activeSpace.cells.length > 0 ? (
            <div className="space-editor__preview" aria-label="Previsualització de la sala">
              <div className="fv-canvas">
                <Suspense fallback={<PanelSuspenseFallback />}>
                  <SpaceView3D
                    space={fp.activeSpace}
                    agentsById={agentsById}
                    queuesById={queuesById}
                    showAvatars
                    animations={false}
                    onSelectAgent={noop}
                  />
                </Suspense>
              </div>
            </div>
          ) : null}
        </aside>

        <div
          className="space-editor__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajusta la proporció de les columnes"
          onPointerDown={startResize}
        >
          <span className="space-editor__resizer-grip" aria-hidden="true" />
        </div>

        <div className="space-editor__main">
          <SpaceToolbar
            tool={fp.tool}
            space={fp.activeSpace}
            dirty={fp.dirty}
            canUndo={fp.canUndo}
            canRedo={fp.canRedo}
            onSelectTool={fp.setTool}
            onRotate={fp.rotateSpace}
            onUndo={fp.undo}
            onRedo={fp.redo}
            onSave={fp.save}
            onReset={fp.reset}
          />
          {fp.saveError ? (
            <div className="space-editor__save-error" role="alert">
              No s'ha pogut desar: {fp.saveError}
            </div>
          ) : null}
          <div className="space-editor__canvas" ref={canvasScrollRef}>
            {fp.activeSpace ? (
              <SpaceGrid
                space={fp.activeSpace}
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
