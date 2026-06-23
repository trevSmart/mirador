import type { Floor, FloorTool } from '../../floor/types'
import { Button } from '../ds'

interface ToolDef {
  tool: FloorTool
  label: string
  glyph: string
  hint: string
}

const TOOLS: ToolDef[] = [
  { tool: 'cell', label: 'Àrea', glyph: '▦', hint: 'Pinta cel·les de terra (arrossega)' },
  { tool: 'seat', label: 'Agent', glyph: '◍', hint: 'Col·loca un seient i assigna-hi un agent' },
  { tool: 'door', label: 'Porta', glyph: '▯', hint: 'Porta a una vora exterior' },
  { tool: 'window', label: 'Finestra', glyph: '▭', hint: 'Finestra a una vora exterior' },
  { tool: 'divider', label: 'Separador', glyph: '┊', hint: 'Mur interior entre dues cel·les' },
  { tool: 'erase', label: 'Esborra', glyph: '⌫', hint: 'Treu cel·les, seients o obertures' },
]

interface FloorToolbarProps {
  tool: FloorTool
  floor: Floor | null
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  onSelectTool: (tool: FloorTool) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onReset: () => void
}

export function FloorToolbar({
  tool,
  floor,
  dirty,
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo,
  onSave,
  onReset,
}: FloorToolbarProps) {
  return (
    <div className="fe-toolbar">
      <div className="fe-toolbar__tools" role="toolbar" aria-label="Eines">
        {TOOLS.map((def) => (
          <button
            key={def.tool}
            type="button"
            className={`fe-tool${tool === def.tool ? ' fe-tool--on' : ''}`}
            onClick={() => onSelectTool(def.tool)}
            title={def.hint}
            aria-pressed={tool === def.tool}
          >
            <span className="fe-tool__glyph" aria-hidden="true">
              {def.glyph}
            </span>
            <span className="fe-tool__label">{def.label}</span>
          </button>
        ))}
      </div>

      <div className="fe-toolbar__spacer" />

      {floor ? (
        <span className="fe-toolbar__meta" aria-label="Recompte d'elements">
          <span>{floor.cells.length} cel·les</span>
          <span>{floor.seats.length} seients</span>
          <span>{floor.openings.length} obertures</span>
          <span>{floor.dividers.length} separadors</span>
        </span>
      ) : null}

      <div className="fe-toolbar__actions">
        <button
          type="button"
          className="fe-icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfés"
          aria-label="Desfés"
        >
          ↶
        </button>
        <button
          type="button"
          className="fe-icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refés"
          aria-label="Refés"
        >
          ↷
        </button>
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
