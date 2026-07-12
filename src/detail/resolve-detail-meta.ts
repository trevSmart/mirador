import type { QueryClient } from '@tanstack/react-query'
import { entityKey } from '../api/data-service'
import type { Agent, Queue, Skill, WorkItem } from '../api/types'
import type { DetailKind, DetailTarget } from './detail-drawer-context'
import type { DetailEntity } from './use-detail-entity'

export const FALLBACK_TITLE: Record<DetailKind, string> = {
  agent: 'Agent',
  queue: 'Cua',
  skill: 'Skill',
  work: 'Treball',
}

/** Títol d'un registre ja resolt (el nom, o el subject si és un work item). */
export function detailTitleOf(entity: DetailEntity | null, kind: DetailKind): string {
  if (!entity) return FALLBACK_TITLE[kind]
  return entity.kind === 'work' ? entity.data.subject : entity.data.name
}

/** Nom de l'entitat del Data Service que guarda els registres de cada kind. */
const ENTITY_OF: Record<DetailKind, string> = {
  agent: 'agent',
  queue: 'queue',
  skill: 'skill',
  work: 'workItem',
}

/**
 * Títol d'un target llegit puntualment de la caché, sense subscriure-s'hi. Per a
 * qui només necessita el títol en el moment d'una acció (obrir com a pestanya) i
 * no vol re-renderitzar-se a cada refresc de dades.
 */
export function readDetailTitle(
  queryClient: QueryClient,
  target: DetailTarget,
): string {
  const record = queryClient.getQueryData<
    Agent | Queue | Skill | WorkItem | null
  >(entityKey('salesforce', ENTITY_OF[target.kind], target.id))

  if (!record) return FALLBACK_TITLE[target.kind]
  return 'subject' in record ? record.subject : record.name
}
