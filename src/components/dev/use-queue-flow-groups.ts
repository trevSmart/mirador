/* Dades compartides del flux cua → agent (Dev Lab): agrega els work items
   actius de N agents per cua d'origen, resolent noms de cua des de la caché.
   El repartiment és fan-out (una cua pot alimentar diversos agents), així que
   la unitat bàsica és la parella (cua, agent) — `cell[qi][ai]`. */

import { useMemo } from 'react'
import type { Agent } from '../../api/types'
import { queueResource, useEntities } from '../../api/data-service'
import { colorFromRecordId } from '../../utils/color-from-string'

/** Items sense cua (assignació directa) — agrupats sota una clau pròpia. */
export const DIRECT_KEY = '__direct__'

/** Node de cua del flux (metadada; els comptes van a part, a `cell`/`qTotal`). */
export interface FlowChartGroup {
  key: string
  queueId: string | null
  name: string
}

/** Model agregat entre agents: matriu cua × agent més els seus totals. */
export interface QueueFlowModel {
  agents: Agent[]
  /** Cues (incloent «Directes» si escau), ordenades de més a menys flux. */
  queues: FlowChartGroup[]
  /** `cell[qi][ai]` = nº d'items de l'agent `ai` amb la cua `qi`. */
  cell: number[][]
  /** Suma d'items per cua (files de `cell`). */
  qTotal: number[]
  /** Suma d'items per agent (= agent.used). */
  aTotal: number[]
  /** Total d'items assignats a través de cues. */
  total: number
}

export function flowGroupColor(group: FlowChartGroup): string {
  return group.queueId ? colorFromRecordId(group.queueId) : 'var(--text-disabled)'
}

export function useQueueFlowModel(
  agents: Agent[],
  /** Noms per a cues que no existeixen a la caché (p. ex. cues de demo). */
  nameOverrides?: Record<string, string>,
): QueueFlowModel {
  const queueIds = useMemo(
    () =>
      [
        ...new Set(
          agents.flatMap((a) => [
            ...a.queueIds,
            ...a.work.map((w) => w.queueId).filter((id): id is string => id !== null),
          ]),
        ),
      ].sort(),
    [agents],
  )
  const queueEntities = useEntities(queueResource, queueIds)

  return useMemo<QueueFlowModel>(() => {
    const nameById = new Map(
      queueIds.map((id, i) => [id, queueEntities[i]?.data?.name ?? null] as const),
    )
    const allWork = agents.flatMap((a) => a.work)
    const groups: FlowChartGroup[] = queueIds.map((id) => ({
      key: id,
      queueId: id,
      name:
        nameById.get(id) ??
        nameOverrides?.[id] ??
        allWork.find((w) => w.queueId === id)?.queue ??
        id,
    }))
    if (allWork.some((w) => w.queueId === null)) {
      groups.push({ key: DIRECT_KEY, queueId: null, name: 'Directes' })
    }

    const cell = groups.map((g) =>
      agents.map(
        (a) =>
          a.work.filter((w) => (g.queueId === null ? w.queueId === null : w.queueId === g.queueId))
            .length,
      ),
    )

    // Cues amb més flux primer; les buides al final, que no distreguin.
    const order = groups
      .map((_, qi) => qi)
      .sort((a, b) => cell[b].reduce((s, n) => s + n, 0) - cell[a].reduce((s, n) => s + n, 0))
    const queues = order.map((qi) => groups[qi])
    const sortedCell = order.map((qi) => cell[qi])
    const qTotal = sortedCell.map((row) => row.reduce((s, n) => s + n, 0))
    const aTotal = agents.map((_, ai) => sortedCell.reduce((s, row) => s + row[ai], 0))
    const total = qTotal.reduce((s, n) => s + n, 0)

    return { agents, queues, cell: sortedCell, qTotal, aTotal, total }
  }, [agents, queueIds, queueEntities, nameOverrides])
}
