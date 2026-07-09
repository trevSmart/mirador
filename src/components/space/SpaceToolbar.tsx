import type { Space, SpaceTool } from '../../space/types'
import { Button } from '../ds'
import { AppIcon } from '../ds/AppIcon'
import { ButtonIcon } from '../ds/ButtonIcon'
import { useAltKey } from './useAltKey'
import { ACT_TOOLS, BUILD_TOOLS, TOOL_ORDER, type ToolDef } from './space-tools'

interface SpaceToolbarProps {
  tool: SpaceTool
  space: Space | null
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  onSelectTool: (tool: SpaceTool) => void
  onRotate: (delta: 1 | -1) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onReset: () => void
}

export function SpaceToolbar({
  tool,
  space,
  dirty,
  canUndo,
  canRedo,
  onSelectTool,
  onRotate,
  onUndo,
  onRedo,
  onSave,
  onReset,
}: SpaceToolbarProps) {
  const alt = useAltKey()

  const toolButton = (def: ToolDef) => (
    <button
      key={def.tool}
      type="button"
      className={`fe-tool${tool === def.tool ? ' fe-tool--on' : ''}${def.tool === 'erase' && tool === 'erase' ? ' is-erase' : ''}`}
      onClick={() => onSelectTool(def.tool)}
      title={def.hint}
      aria-pressed={tool === def.tool}
    >
      <span className="fe-tool__key" aria-hidden="true">
        {TOOL_ORDER.indexOf(def.tool) + 1}
      </span>
      <span className="fe-tool__glyph" aria-hidden="true">
        <AppIcon name={def.icon} size={17} />
      </span>
      <span className="fe-tool__label">{def.label}</span>
    </button>
  )

  return (
    <div className="fe-toolbar">
      <div className="fe-toolbar__tools" role="toolbar" aria-label="Eines">
        {ACT_TOOLS.map(toolButton)}
        <span className="fe-toolbar__sep" aria-hidden="true" />
        {BUILD_TOOLS.map(toolButton)}
        {/* Amb l'eina Esborra activa la pista seria redundant. */}
        {alt && tool !== 'erase' ? <span className="fe-toolbar__hint">⌫ Alt · esborrant</span> : null}
      </div>

      <div className="fe-toolbar__spacer" />

      {space ? (
        <span className="fe-toolbar__meta" aria-label="Recompte d'elements">
          <span>
            {space.seats.filter((seat) => seat.agentId).length} agents en{' '}
            {space.seats.length} seients
          </span>
        </span>
      ) : null}

      <div className="fe-toolbar__actions">
        <ButtonIcon
          className="fe-icon-btn"
          title="Gira a l'esquerra"
          aria-label="Gira a l'esquerra"
          onClick={() => onRotate(-1)}
          disabled={!space}
          icon="rotate-ccw"
        />
        <ButtonIcon
          className="fe-icon-btn"
          title="Gira a la dreta"
          aria-label="Gira a la dreta"
          onClick={() => onRotate(1)}
          disabled={!space}
          icon="rotate-cw"
        />
        <ButtonIcon
          className="fe-icon-btn"
          title="Desfés"
          aria-label="Desfés"
          onClick={onUndo}
          disabled={!canUndo}
          icon="undo"
        />
        <ButtonIcon
          className="fe-icon-btn"
          title="Refés"
          aria-label="Refés"
          onClick={onRedo}
          disabled={!canRedo}
          icon="redo"
        />
        <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty}>
          Restableix
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty}>
          Desa
        </Button>
      </div>
    </div>
  )
}
