import type { DockviewApi } from 'dockview-react'
import { PANEL_COMPONENTS, getPanelDefinition, type PanelType } from './registry'

let panelCounter = 0

// Every params push carries a fresh revision so the receiving panel can adopt
// it even when the values repeat (e.g. re-clicking "Veure tots" on Home after
// changing the local filter). Seeded with Date.now() so a revision persisted
// in a saved layout from a previous session is never reissued.
let paramsRevision = Date.now()

export function getPanelTypeFromComponent(component: string | undefined): PanelType | null {
  if (!component) {
    return null
  }
  if (component in PANEL_COMPONENTS) {
    return component as PanelType
  }
  return null
}

export function getOpenPanelTypes(api: DockviewApi): PanelType[] {
  return api.panels
    .map((panel) => getPanelTypeFromComponent(panel.view.contentComponent))
    .filter((type): type is PanelType => type !== null)
}

export function isPanelClosable(type: PanelType): boolean {
  return type !== 'home'
}

export function ensureHomePanel(api: DockviewApi): void {
  const hasHome = api.panels.some(
    (panel) => getPanelTypeFromComponent(panel.view.contentComponent) === 'home',
  )
  if (!hasHome) {
    addPanelByType(api, 'home')
  }
}

export function addPanelByType(
  api: DockviewApi,
  type: PanelType,
  params?: Record<string, unknown>,
): void {
  // If a panel of this type is already open, reveal it instead of opening a
  // duplicate (or doing nothing). When params are supplied (e.g. a presence
  // filter propagated from Home), push them into the already-open panel too.
  const existing = api.panels.find(
    (panel) => getPanelTypeFromComponent(panel.view.contentComponent) === type,
  )
  if (existing) {
    if (params) {
      paramsRevision += 1
      existing.api.updateParameters({ ...params, revision: paramsRevision })
    }
    existing.api.setActive()
    return
  }

  const definition = getPanelDefinition(type)
  panelCounter += 1
  api.addPanel({
    id: `${type}-${panelCounter}`,
    component: type,
    title: definition.title,
    params,
  })
}
