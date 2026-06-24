import type { FunctionComponent } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { SfIconName } from '../components/ds/SfIcon'
import { AgentsPanel } from './AgentsPanel'
import { FloorEditorPanel } from './FloorEditorPanel'
import { FloorPanel } from './FloorPanel'
import { HomePanel } from './HomePanel'
import { InsightsPanel } from './InsightsPanel'
import { QueuesPanel } from './QueuesPanel'
import { SkillsPanel } from './SkillsPanel'
import { WorkPanel } from './WorkPanel'

export type PanelType =
  | 'home'
  | 'insights'
  | 'agents'
  | 'queues'
  | 'skills'
  | 'work'
  | 'floor'
  | 'floorEditor'

export interface PanelDefinition {
  type: PanelType
  title: string
  iconName: SfIconName
  component: FunctionComponent<IDockviewPanelProps>
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { type: 'home', title: 'Home', iconName: 'home', component: HomePanel },
  { type: 'insights', title: 'Insights', iconName: 'insights', component: InsightsPanel },
  { type: 'agents', title: 'Agents', iconName: 'agent', component: AgentsPanel },
  { type: 'queues', title: 'Queues', iconName: 'queue', component: QueuesPanel },
  { type: 'skills', title: 'Skills', iconName: 'skill', component: SkillsPanel },
  { type: 'work', title: 'Work', iconName: 'work', component: WorkPanel },
  { type: 'floor', title: 'Floor', iconName: 'floor', component: FloorPanel },
  { type: 'floorEditor', title: 'Floor editor', iconName: 'floorEditor', component: FloorEditorPanel },
]

export const PANEL_COMPONENTS = Object.fromEntries(
  PANEL_DEFINITIONS.map((panel) => [panel.type, panel.component]),
) as Record<PanelType, FunctionComponent<IDockviewPanelProps>>

export function getPanelDefinition(type: PanelType): PanelDefinition {
  const panel = PANEL_DEFINITIONS.find((item) => item.type === type)
  if (!panel) {
    throw new Error(`Unknown panel type: ${type}`)
  }
  return panel
}
