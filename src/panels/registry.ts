import { createElement, lazy, Suspense, type FunctionComponent, type LazyExoticComponent } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { SfIconName } from '../components/ds/SfIcon'
import { ErrorBoundary } from '../components/error/ErrorBoundary'
import { PanelErrorFallback } from '../components/error/PanelErrorFallback'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'

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
  component: LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { type: 'home',        title: 'Home',         iconName: 'home',        component: lazy(() => import('./HomePanel').then(m => ({ default: m.HomePanel }))) },
  { type: 'insights',   title: 'Insights',     iconName: 'insights',   component: lazy(() => import('./InsightsPanel').then(m => ({ default: m.InsightsPanel }))) },
  { type: 'agents',     title: 'Agents',       iconName: 'agent',      component: lazy(() => import('./AgentsPanel').then(m => ({ default: m.AgentsPanel }))) },
  { type: 'queues',     title: 'Queues',       iconName: 'queue',      component: lazy(() => import('./QueuesPanel').then(m => ({ default: m.QueuesPanel }))) },
  { type: 'skills',     title: 'Skills',       iconName: 'skill',      component: lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel }))) },
  { type: 'work',       title: 'Work',         iconName: 'work',       component: lazy(() => import('./WorkPanel').then(m => ({ default: m.WorkPanel }))) },
  { type: 'floor',      title: 'Floor',        iconName: 'floor',      component: lazy(() => import('./FloorPanel').then(m => ({ default: m.FloorPanel }))) },
  { type: 'floorEditor', title: 'Floor editor', iconName: 'floorEditor', component: lazy(() => import('./FloorEditorPanel').then(m => ({ default: m.FloorEditorPanel }))) },
]

function withPanelErrorBoundary(
  PanelComponent: LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>,
): FunctionComponent<IDockviewPanelProps> {
  const Wrapped: FunctionComponent<IDockviewPanelProps> = (props) =>
    createElement(Suspense, {
      fallback: createElement(PanelSuspenseFallback),
      children: createElement(ErrorBoundary, {
        fallback: (error, reset) => createElement(PanelErrorFallback, { error, reset }),
        children: createElement(PanelComponent, props),
      }),
    })
  Wrapped.displayName = `PanelLazy(${(PanelComponent as { displayName?: string }).displayName ?? 'Panel'})`
  return Wrapped
}

export const PANEL_COMPONENTS = Object.fromEntries(
  PANEL_DEFINITIONS.map((panel) => [panel.type, withPanelErrorBoundary(panel.component)]),
) as Record<PanelType, FunctionComponent<IDockviewPanelProps>>

export function getPanelDefinition(type: PanelType): PanelDefinition {
  const panel = PANEL_DEFINITIONS.find((item) => item.type === type)
  if (!panel) {
    throw new Error(`Unknown panel type: ${type}`)
  }
  return panel
}
