/* Resol un DetailTarget (kind + id) al registre que representa, llegint-lo de la
   caché del Data Service en comptes de buscar-lo dins la col·lecció sencera.

   Els consumidors de detall (panel, drawer, icona de pestanya) només necessiten
   un registre, però abans se subscrivien a agents+cues+skills+work per fer-hi un
   `find`: qualsevol canvi a qualsevol agent els re-renderitzava. La query de
   snapshot ja prima cada registre sota la seva pròpia clau (primeSnapshot), així
   que aquí n'hi ha prou de llegir l'entrada concreta.

   Fa una crida a useEntity per cada tipus i deshabilita les tres que no toquen
   (params null). El nombre de hooks és fix, cosa que permet cridar-lo dues
   vegades seguides al drawer, que durant la transició té dos targets vius. */

import {
  agentResource,
  queueResource,
  skillResource,
  useEntity,
  workItemResource,
} from '../api/data-service'
import type { Agent, Queue, Skill, WorkItem } from '../api/types'
import type { DetailKind, DetailTarget } from './detail-drawer-context'

export type DetailEntity =
  | { kind: 'agent'; data: Agent }
  | { kind: 'queue'; data: Queue }
  | { kind: 'skill'; data: Skill }
  | { kind: 'work'; data: WorkItem }

export interface DetailEntityResult {
  /** El registre resolt, o null si encara carrega o no existeix. */
  entity: DetailEntity | null
  /** Primera càrrega sense dades a la caché (no hi ha hagut cap snapshot encara). */
  isLoading: boolean
}

/** Id a buscar per aquest tipus, o null perquè useEntity no consulti res. */
function idFor(target: DetailTarget | null | undefined, kind: DetailKind) {
  return target?.kind === kind ? target.id : null
}

export function useDetailEntity(
  target: DetailTarget | null | undefined,
): DetailEntityResult {
  const agent = useEntity(agentResource, idFor(target, 'agent'))
  const queue = useEntity(queueResource, idFor(target, 'queue'))
  const skill = useEntity(skillResource, idFor(target, 'skill'))
  const work = useEntity(workItemResource, idFor(target, 'work'))

  if (!target) return { entity: null, isLoading: false }

  switch (target.kind) {
    case 'agent':
      return {
        entity: agent.data ? { kind: 'agent', data: agent.data } : null,
        isLoading: agent.isLoading,
      }
    case 'queue':
      return {
        entity: queue.data ? { kind: 'queue', data: queue.data } : null,
        isLoading: queue.isLoading,
      }
    case 'skill':
      return {
        entity: skill.data ? { kind: 'skill', data: skill.data } : null,
        isLoading: skill.isLoading,
      }
    case 'work':
      return {
        entity: work.data ? { kind: 'work', data: work.data } : null,
        isLoading: work.isLoading,
      }
  }
}
