import type { DockviewApi } from 'dockview'
import { PANEL_COMPONENTS, getPanelDefinition, type PanelType } from './registry'

let panelCounter = 0

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

export function addPanelByType(api: DockviewApi, type: PanelType): void {
  // If a panel of this type is already open, reveal it instead of opening a
  // duplicate (or doing nothing).
  const existing = api.panels.find(
    (panel) => getPanelTypeFromComponent(panel.view.contentComponent) === type,
  )
  if (existing) {
    existing.api.setActive()
    return
  }

  const definition = getPanelDefinition(type)
  panelCounter += 1
  api.addPanel({
    id: `${type}-${panelCounter}`,
    component: type,
    title: definition.title,
  })
}
