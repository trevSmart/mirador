import type { Agent, Queue } from '../api/types'
import { colorFromRecordId } from '../utils/color-from-string'
import type { AllocatorInput, AllocatorQueue, SkillProfile } from './allocator-types'

/**
 * Derive AllocatorInput from the live snapshot.
 *
 * Profiles reflect full queue-eligibility (`agent.queueIds`). Current staffing
 * uses a primary-queue heuristic so each online agent counts exactly once:
 * among the agent's memberships, pick the queue with the highest backlog
 * (name ascending on ties). That keeps `sum(current) === total`.
 */
export function buildAllocatorInput(
  agents: Agent[],
  queues: Queue[],
): AllocatorInput {
  const sortedQueues = [...queues].sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  const queueIndex = new Map(sortedQueues.map((q, i) => [q.id, i] as const))
  const backlogById = new Map(sortedQueues.map((q) => [q.id, q.backlog] as const))

  const allocatorQueues: AllocatorQueue[] = sortedQueues.map((q) => ({
    id: q.id,
    name: q.name,
    hue: colorFromRecordId(q.id),
  }))

  const roster = agents.filter((a) => a.status === 'online')

  const groups = new Map<string, { skills: number[]; cap: number }>()
  for (const agent of roster) {
    const indices = agent.queueIds
      .map((id) => queueIndex.get(id))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b)
    // Deduplicate (membership can theoretically list a queue twice).
    const unique = [...new Set(indices)]
    const key = unique.join(',')
    const existing = groups.get(key)
    if (existing) {
      existing.cap++
    } else {
      groups.set(key, { skills: unique, cap: 1 })
    }
  }

  const profiles: SkillProfile[] = [...groups.entries()].map(([key, g], i) => ({
    id: key || `empty-${i}`,
    cap: g.cap,
    skills: g.skills,
  }))

  const current = new Array<number>(sortedQueues.length).fill(0)
  for (const agent of roster) {
    const primary = pickPrimaryQueue(agent.queueIds, sortedQueues, backlogById, queueIndex)
    if (primary !== null) {
      current[primary]++
    }
  }

  return {
    queues: allocatorQueues,
    profiles,
    total: roster.length,
    current,
  }
}

function pickPrimaryQueue(
  queueIds: string[],
  sortedQueues: Queue[],
  backlogById: Map<string, number>,
  queueIndex: Map<string, number>,
): number | null {
  const members = queueIds
    .map((id) => {
      const idx = queueIndex.get(id)
      if (idx === undefined) return null
      return { idx, id, backlog: backlogById.get(id) ?? 0, name: sortedQueues[idx].name }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  if (members.length === 0) return null

  members.sort((a, b) => {
    if (b.backlog !== a.backlog) return b.backlog - a.backlog
    return a.name.localeCompare(b.name, 'ca')
  })
  return members[0].idx
}
