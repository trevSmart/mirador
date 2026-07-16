import { createElement, lazy, Suspense, type FunctionComponent, type LazyExoticComponent } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { AppIconName } from '../components/ds/app-icon-names.generated'
import type { SfIconName, SfSprite } from '../components/ds/SfIcon'
import { ErrorBoundary } from '../components/error/ErrorBoundary'
import { PanelErrorFallback } from '../components/error/PanelErrorFallback'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'

export type PanelType =
  | 'home'
  | 'wallboard'
  | 'agents'
  | 'queues'
  | 'skills'
  | 'work'
  | 'space'
  | 'spaceEditor'
  | 'devLab'
  | 'devLab2'
  | 'colorPlayground'

type PanelIcon =
  | { name: SfIconName }
  | { sprite: SfSprite; symbol: string }
  | { app: AppIconName }

export interface PanelDefinition {
  type: PanelType
  title: string
  description: string
  icon: PanelIcon
  component: LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { type: 'home',        title: 'Home',         description: 'Vista general del teu centre',      icon: { sprite: 'standard', symbol: 'home' },               component: lazy(() => import('./HomePanel').then(m => ({ default: m.HomePanel }))) },
  { type: 'wallboard',  title: 'Wallboard',    description: 'Mètriques del servei en directe',   icon: { sprite: 'standard', symbol: 'metrics' },            component: lazy(() => import('./WallboardPanel').then(m => ({ default: m.WallboardPanel }))) },
  { type: 'agents',     title: 'Agents',       description: 'Estat i activitat dels agents',     icon: { sprite: 'standard', symbol: 'customers' },         component: lazy(() => import('./AgentsPanel').then(m => ({ default: m.AgentsPanel }))) },
  { type: 'queues',     title: 'Queues',       description: 'Cues i temps d’espera',         icon: { name: 'queue' },                                   component: lazy(() => import('./QueuesPanel').then(m => ({ default: m.QueuesPanel }))) },
  { type: 'skills',     title: 'Skills',       description: 'Competències i assignacions',       icon: { name: 'skill' },                                   component: lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel }))) },
  { type: 'work',       title: 'Work',         description: 'Work items en curs',                icon: { name: 'work' },                                    component: lazy(() => import('./WorkPanel').then(m => ({ default: m.WorkPanel }))) },
  { type: 'space',      title: 'Space',        description: 'El teu espai de treball',           icon: { sprite: 'standard', symbol: 'business_unit' },      component: lazy(() => import('./SpacePanel').then(m => ({ default: m.SpacePanel }))) },
  { type: 'spaceEditor', title: 'Space editor', description: 'Dissenya i organitza l’espai', icon: { sprite: 'custom', symbol: 'custom83' },              component: lazy(() => import('./SpaceEditorPanel').then(m => ({ default: m.SpaceEditorPanel }))) },
  { type: 'devLab',     title: 'Dev Lab',      description: 'Experiments de desenvolupament',    icon: { sprite: 'standard', symbol: 'code_playground' },    component: lazy(() => import('./DevLabPanel').then(m => ({ default: m.DevLabPanel }))) },
  { type: 'devLab2',    title: 'Dev Lab 2',    description: 'Jerarquia de rols i noves visualitzacions', icon: { sprite: 'standard', symbol: 'hierarchy' },  component: lazy(() => import('./DevLab2Panel').then(m => ({ default: m.DevLab2Panel }))) },
  { type: 'colorPlayground', title: 'Color playground', description: 'Prova temes i colors', icon: { app: 'color_swatch' }, component: lazy(() => import('./ColorPlaygroundPanel').then(m => ({ default: m.ColorPlaygroundPanel }))) },
]

export interface PanelMenuGroup {
  label: string
  types: PanelType[]
}

export const PANEL_MENU_GROUPS: PanelMenuGroup[] = [
  { label: 'Supervise', types: ['home', 'wallboard', 'space'] },
  { label: 'Track',     types: ['agents', 'queues', 'skills', 'work'] },
  { label: 'Customize', types: ['spaceEditor', 'devLab', 'devLab2', 'colorPlayground'] },
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
