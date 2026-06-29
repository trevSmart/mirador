import type { Agent, Queue } from '../api/types'
import { colorFromString } from '../utils/color-from-string'

export interface TowerSegment {
  queueId: string | null
  color: string
  count: number
  /** Share of used capacity (count / agent.used). */
  fraction: number
}

const FALLBACK_COLOR = 'var(--text-muted)'

function resolveQueueColor(queueId: string | null): string {
  return queueId ? colorFromString(queueId) : FALLBACK_COLOR
}

/** Stack tower segments bottom-to-top, one per queue represented in active work. */
export function agentTowerSegments(
  agent: Agent,
  queuesById: Map<string, Queue>,
): TowerSegment[] {
  if (agent.used <= 0) return []

  const counts = new Map<string, { queueId: string | null; count: number }>()
  for (const item of agent.work) {
    const key = item.queueId ?? '__unknown__'
    const entry = counts.get(key) ?? { queueId: item.queueId, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }

  const unattributed = agent.used - agent.work.length
  if (unattributed > 0) {
    const key = '__unknown__'
    const entry = counts.get(key) ?? { queueId: null, count: 0 }
    entry.count += unattributed
    counts.set(key, entry)
  }

  const used = agent.used
  return [...counts.values()]
    .sort((a, b) => queueLabel(a.queueId, queuesById).localeCompare(queueLabel(b.queueId, queuesById), 'ca'))
    .map(({ queueId, count }) => ({
      queueId,
      color: resolveQueueColor(queueId),
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

function queueLabel(queueId: string | null, queuesById: Map<string, Queue>): string {
  if (queueId) {
    return queuesById.get(queueId)?.name ?? queueId
  }
  return '\uffff'
}
