import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import { AgentAssignPalette } from '../components/space/AgentAssignPalette'
import { SpaceGrid } from '../components/space/SpaceGrid'
import { SpaceSidebar } from '../components/space/SpaceSidebar'
import { SpaceToolbar } from '../components/space/SpaceToolbar'
import { TOOL_ORDER } from '../components/space/space-tools'
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
const DEFAULT_SPLIT = 0.3

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
  return DEFAULT_SPLIT
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
  const [logoError, setLogoError] = useState<string | null>(null)

  // Keyboard shortcuts while the editor is mounted: 1–7 pick a tool (palette
  // order), ⌘/Ctrl+Z undoes, ⇧⌘/Ctrl+Z redoes. Ignored while typing.
  const { setTool, undo, redo } = fp
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const digit = Number.parseInt(event.key, 10)
      if (digit >= 1 && digit <= TOOL_ORDER.length) {
        setTool(TOOL_ORDER[digit - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTool, undo, redo])

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

    // Drive the drag straight through the DOM: writing the CSS var and the
    // `is-resizing` class avoids re-rendering the (heavy) canvas on every
    // pointermove. React state is only synced once, on release.
    let latest = split
    let frame = 0
    layout.classList.add('is-resizing')
    // Coalesce pointermove bursts to one DOM write per frame: pointermove can
    // fire several times between paints, so we only apply the latest value.
    const flush = () => {
      frame = 0
      layout.style.setProperty('--fe-split', `${latest / (1 - latest)}fr`)
    }
    const onMove = (move: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const fraction = (move.clientX - rect.left) / rect.width
      latest = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction))
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (frame) cancelAnimationFrame(frame)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      layout.classList.remove('is-resizing')
      setSplit(latest)
      try {
        localStorage.setItem(SPLIT_KEY, String(latest))
      } catch {
        /* ignore */
      }
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [split])

  // Double-clicking the divider restores the default column proportions.
  const resetSplit = useCallback(() => {
    setSplit(DEFAULT_SPLIT)
    try {
      localStorage.setItem(SPLIT_KEY, String(DEFAULT_SPLIT))
    } catch {
      /* ignore */
    }
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
              folders={fp.folders}
              agentsById={agentsById}
              queuesById={queuesById}
              activeFolderId={fp.data.activeFolderId}
              activeSpaceId={fp.data.activeSpaceId}
              onSelectFolder={fp.selectFolder}
              onAddFolder={fp.addFolder}
              onRemoveFolder={fp.removeFolder}
              onRenameFolder={fp.renameFolder}
              onSetFolderImage={fp.setFolderImage}
              onToggleFolderActive={fp.toggleFolderActive}
              onMoveFolder={fp.moveFolder}
              logoError={logoError}
              onLogoError={setLogoError}
              onSelectSpace={fp.selectSpace}
              onAddSpace={fp.addSpace}
              onRemoveSpace={fp.removeSpace}
              onDuplicateSpace={fp.duplicateSpace}
              onRenameSpace={fp.renameSpace}
              onToggleSpaceActive={fp.toggleSpaceActive}
              onMoveSpace={fp.moveSpace}
              onMoveSpaceToFolder={fp.moveSpaceToFolder}
              onExport={fp.exportJson}
              onImport={openImportDialog}
            />
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
                    showTooltip={false}
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
          aria-label="Ajusta la proporció de les columnes (doble clic per restablir)"
          onPointerDown={startResize}
          onDoubleClick={resetSplit}
        >
          <span className="space-editor__resizer-grip" aria-hidden="true" />
        </div>

        <div className="space-editor__main">
          <div className="fe-editor">
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
                  onEraseCellRect={fp.eraseCellRectAt}
                  onSeatTap={fp.seatAt}
                  onEdgeTap={fp.applyEdge}
                  onEraseEdge={fp.eraseEdgeAt}
                  resolveAt={fp.resolveAt}
                  rectBlockedAt={fp.rectBlockedAt}
                  elementAtRef={fp.elementAtRef}
                  canDropAt={fp.canDropAt}
                  onMove={fp.applyMove}
                />
              ) : (
                <p className="panel-state panel-state--muted">Aquesta planta no té cap cel·la.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PanelShell>
  )
}
