import type { Agent, Queue } from '../api/types'

export interface TowerSegment {
  queueId: string | null
  color: string
  count: number
  /** Share of used capacity (count / agent.used). */
  fraction: number
}

const FALLBACK_COLOR = 'var(--text-muted)'

function resolveQueueColor(
  queueId: string | null,
  queueName: string | null | undefined,
  queuesById: Map<string, Queue>,
): string {
  if (queueId) {
    const byId = queuesById.get(queueId)
    if (byId) return byId.color
  }
  if (queueName) {
    for (const queue of queuesById.values()) {
      if (queue.name === queueName) return queue.color
    }
  }
  return FALLBACK_COLOR
}

/** Stack tower segments bottom-to-top, one per queue represented in active work. */
export function agentTowerSegments(
  agent: Agent,
  queuesById: Map<string, Queue>,
): TowerSegment[] {
  if (agent.used <= 0) return []

  const counts = new Map<string, { queueId: string | null; queueName: string | null; count: number }>()
  for (const item of agent.work) {
    const key = item.queueId ?? item.queue ?? '__unknown__'
    const entry = counts.get(key) ?? {
      queueId: item.queueId,
      queueName: item.queue,
      count: 0,
    }
    entry.count += 1
    counts.set(key, entry)
  }

  const unattributed = agent.used - agent.work.length
  if (unattributed > 0) {
    const key = '__unknown__'
    const entry = counts.get(key) ?? { queueId: null, queueName: null, count: 0 }
    entry.count += unattributed
    counts.set(key, entry)
  }

  const used = agent.used
  return [...counts.values()]
    .sort((a, b) =>
      queueLabel(a.queueId, a.queueName, queuesById).localeCompare(
        queueLabel(b.queueId, b.queueName, queuesById),
        'ca',
      ),
    )
    .map(({ queueId, queueName, count }) => ({
      queueId,
      color: resolveQueueColor(queueId, queueName, queuesById),
      count,
      fraction: count / used,
    }))
}

export function towerSegmentLabel(
  segment: TowerSegment,
  queuesById: Map<string, Queue>,
): string {
  if (segment.queueId) {
    return queuesById.get(segment.queueId)?.name ?? 'Sense cua'
  }
  return 'Sense cua'
}

function queueLabel(
  queueId: string | null,
  queueName: string | null | undefined,
  queuesById: Map<string, Queue>,
): string {
  if (queueId) {
    return queuesById.get(queueId)?.name ?? queueId
  }
  if (queueName) return queueName
  return '\uffff'
}
