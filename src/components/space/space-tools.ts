import type { SpaceTool } from '../../space/types'
import type { AppIconName } from '../ds/app-icon-names.generated'

export interface ToolDef {
  tool: SpaceTool
  label: string
  icon: AppIconName
  hint: string
}

/* Palette in two groups split by a hairline: first the tools that act on what
   already exists (Mou · Esborra), then the ones that add. Shortcut digits
   follow palette order. */
export const ACT_TOOLS: ToolDef[] = [
  { tool: 'move', label: 'Mou', icon: 'move', hint: 'Mou un element existent (arrossega)' },
  { tool: 'erase', label: 'Esborra', icon: 'eraser', hint: 'Treu cel·les, seients o obertures' },
]

export const BUILD_TOOLS: ToolDef[] = [
  { tool: 'cell', label: 'Àrea', icon: 'area', hint: 'Pinta cel·les de terra (arrossega)' },
  { tool: 'seat', label: 'Agent', icon: 'seat', hint: 'Col·loca un seient i assigna-hi un agent' },
  { tool: 'door', label: 'Porta', icon: 'door', hint: 'Porta a una vora exterior' },
  { tool: 'window', label: 'Finestra', icon: 'window', hint: 'Finestra a una vora exterior' },
  { tool: 'divider', label: 'Separador', icon: 'divider', hint: 'Mur interior entre dues cel·les' },
]

/** Palette order — digit shortcuts (1–7) map onto this. */
export const TOOL_ORDER: SpaceTool[] = [...ACT_TOOLS, ...BUILD_TOOLS].map((t) => t.tool)
