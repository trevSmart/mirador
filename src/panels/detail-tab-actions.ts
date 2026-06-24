import type { DockviewApi } from 'dockview-react'
import type { DetailTarget } from '../detail/detail-drawer-context'
import { DETAIL_PANEL_COMPONENT, detailPanelId } from '../detail/detail-panel'

export function openDetailTab(api: DockviewApi, target: DetailTarget, title: string): void {
  const id = detailPanelId(target)
  const existing = api.panels.find((panel) => panel.id === id)
  if (existing) {
    existing.api.setActive()
    if (existing.api.title !== title) {
      existing.api.setTitle(title)
    }
    return
  }

  api.addPanel({
    id,
    component: DETAIL_PANEL_COMPONENT,
    title,
    params: {
      kind: target.kind,
      id: target.id,
    },
  })
}
