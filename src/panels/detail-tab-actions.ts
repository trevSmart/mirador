import type { DockviewApi } from 'dockview-react'
import type { DetailTarget } from '../detail/detail-drawer-context'
import { DETAIL_PANEL_COMPONENT, detailPanelId } from '../detail/detail-panel'
import { FALLBACK_TITLE } from '../detail/resolve-detail-meta'

/* Sense títol explícit, un panell existent conserva el que ja té (p. ex. el
   restaurat del layout); el fallback genèric només s'usa en crear-lo. */
export function openDetailTab(api: DockviewApi, target: DetailTarget, title?: string): void {
  const id = detailPanelId(target)
  const existing = api.panels.find((panel) => panel.id === id)
  if (existing) {
    existing.api.setActive()
    if (title && existing.api.title !== title) {
      existing.api.setTitle(title)
    }
    return
  }

  api.addPanel({
    id,
    component: DETAIL_PANEL_COMPONENT,
    title: title ?? FALLBACK_TITLE[target.kind],
    params: {
      kind: target.kind,
      id: target.id,
    },
  })
}
