/* Codec del hash de navegació — funcions pures que tradueixen entre la URL
   (#agents, #detail/agent/<id>) i una destinació de navegació tipada.
   Reutilitza els validadors existents: getPanelTypeFromComponent per als
   panells del registre i parseDetailPanelParams per als tabs de detall. */

import type { IDockviewPanel } from 'dockview-react'
import type { DetailTarget } from '../detail/detail-drawer-context'
import { isDetailPanelComponent, parseDetailPanelParams } from '../detail/detail-panel'
import { getPanelTypeFromComponent } from '../panels/panel-actions'
import type { PanelType } from '../panels/registry'

export type NavDestination =
  | { kind: 'panel'; panel: PanelType }
  | { kind: 'detail'; target: DetailTarget }

const DETAIL_PREFIX = 'detail/'

export function serializeNavHash(dest: NavDestination): string {
  if (dest.kind === 'panel') {
    return `#${dest.panel}`
  }
  return `#${DETAIL_PREFIX}${dest.target.kind}/${encodeURIComponent(dest.target.id)}`
}

export function parseNavHash(hash: string): NavDestination | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) {
    return null
  }

  if (raw.startsWith(DETAIL_PREFIX)) {
    const [kind, ...idSegments] = raw.slice(DETAIL_PREFIX.length).split('/')
    let id: string
    try {
      id = decodeURIComponent(idSegments.join('/'))
    } catch {
      return null
    }
    const params = parseDetailPanelParams({ kind, id })
    if (!params) {
      return null
    }
    return { kind: 'detail', target: params }
  }

  const panel = getPanelTypeFromComponent(raw)
  if (!panel) {
    return null
  }
  return { kind: 'panel', panel }
}

/** Destinació que representa un panell obert de dockview, o null si el
    component no és navegable (component desconegut o legacy). */
export function destinationFromPanel(panel: IDockviewPanel): NavDestination | null {
  const component = panel.view.contentComponent
  const panelType = getPanelTypeFromComponent(component)
  if (panelType) {
    return { kind: 'panel', panel: panelType }
  }
  if (isDetailPanelComponent(component)) {
    const target = parseDetailPanelParams(panel.params)
    if (target) {
      return { kind: 'detail', target }
    }
  }
  return null
}
