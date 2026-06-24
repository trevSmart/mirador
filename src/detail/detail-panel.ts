import type { DetailKind, DetailTarget } from './detail-drawer-context'

export const DETAIL_PANEL_COMPONENT = 'detail' as const

export interface DetailPanelParams {
  kind: DetailKind
  id: string
}

export function detailPanelId(target: DetailTarget): string {
  return `detail-${target.kind}-${target.id}`
}

export function detailTargetsMatch(a: DetailTarget, b: DetailTarget): boolean {
  return a.kind === b.kind && a.id === b.id
}

export function isDetailPanelComponent(component: string | undefined): boolean {
  return component === DETAIL_PANEL_COMPONENT
}

export function parseDetailPanelParams(params: unknown): DetailPanelParams | null {
  if (!params || typeof params !== 'object') {
    return null
  }
  const { kind, id } = params as Partial<DetailPanelParams>
  if ((kind !== 'agent' && kind !== 'queue' && kind !== 'skill') || typeof id !== 'string' || !id) {
    return null
  }
  return { kind, id }
}
