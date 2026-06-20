import type { FunctionComponent, SVGProps } from 'react'
import type { IDockviewPanelProps } from 'dockview'
import { AgentsPanel } from './AgentsPanel'
import {
  AgentsPanelIcon,
  HomePanelIcon,
  QueuesPanelIcon,
  SkillsPanelIcon,
  WorkPanelIcon,
} from './icons'
import { HomePanel } from './HomePanel'
import { QueuesPanel } from './QueuesPanel'
import { SkillsPanel } from './SkillsPanel'
import { WorkPanel } from './WorkPanel'

export type PanelType = 'home' | 'agents' | 'queues' | 'skills' | 'work'

type PanelIconComponent = FunctionComponent<SVGProps<SVGSVGElement>>

export interface PanelDefinition {
  type: PanelType
  title: string
  icon: PanelIconComponent
  component: FunctionComponent<IDockviewPanelProps>
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { type: 'home', title: 'Home', icon: HomePanelIcon, component: HomePanel },
  { type: 'agents', title: 'Agents', icon: AgentsPanelIcon, component: AgentsPanel },
  { type: 'queues', title: 'Queues', icon: QueuesPanelIcon, component: QueuesPanel },
  { type: 'skills', title: 'Skills', icon: SkillsPanelIcon, component: SkillsPanel },
  { type: 'work', title: 'Work', icon: WorkPanelIcon, component: WorkPanel },
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
