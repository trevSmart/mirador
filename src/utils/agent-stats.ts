import type { Agent, PresenceStatus, Queue, Skill, WorkItem } from '../api/types'

export interface AgentStatusCounts {
  online: number
  busy: number
  away: number
  offline: number
}

export function countAgentsByStatus(agents: Agent[]): AgentStatusCounts {
  return agents.reduce<AgentStatusCounts>(
    (counts, agent) => {
      counts[agent.status] += 1
      return counts
    },
    { online: 0, busy: 0, away: 0, offline: 0 },
  )
}

/**
 * Colour token for an agent's capacity bar, driven by how close the agent is to
 * their capacity ceiling (free slots), not by presence: green with room to
 * spare, amber with a single slot left, red when full — so a glance shows who
 * is maxed out. Offline agents stay muted since they aren't taking work.
 */
export function capacityColor(agent: Agent): string {
  if (agent.status === 'offline') {
    return 'var(--text-disabled)'
  }
  const free = agent.max - agent.used
  if (free <= 0) {
    return 'var(--status-alert)'
  }
  if (free === 1) {
    return 'var(--status-watch)'
  }
  return 'var(--status-ok)'
}

export function totalQueueBacklog(queues: Queue[]): number {
  return queues.reduce((total, queue) => total + queue.backlog, 0)
}

export function sortQueuesByBacklog(queues: Queue[]): Queue[] {
  return [...queues].sort((left, right) => right.backlog - left.backlog)
}

export type QueueSortKey = 'backlog' | 'longest' | 'avg' | 'online' | 'name'

/** Sort queues by the chosen criterion, breaking ties alphabetically. */
export function sortQueues(queues: Queue[], key: QueueSortKey): Queue[] {
  const byName = (left: Queue, right: Queue) => left.name.localeCompare(right.name, 'ca')
  switch (key) {
    case 'name':
      return [...queues].sort(byName)
    case 'longest':
      return [...queues].sort((left, right) => right.longest - left.longest || byName(left, right))
    case 'avg':
      return [...queues].sort((left, right) => right.avg - left.avg || byName(left, right))
    case 'online':
      return [...queues].sort((left, right) => right.online - left.online || byName(left, right))
    default:
      return [...queues].sort((left, right) => right.backlog - left.backlog || byName(left, right))
  }
}

function sortAgentsByName(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => left.name.localeCompare(right.name, 'ca'))
}

function presencePriority(status: PresenceStatus): number {
  switch (status) {
    case 'online':
      return 0
    case 'busy':
      return 1
    case 'away':
      return 2
    default:
      return 3
  }
}

export function sortAgentsByPresence(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => {
    const statusDiff = presencePriority(left.status) - presencePriority(right.status)
    if (statusDiff !== 0) {
      return statusDiff
    }
    return left.name.localeCompare(right.name, 'ca')
  })
}

export type AgentSortKey = 'presence' | 'work' | 'capacity' | 'name'

/** Sort agents by the chosen criterion, breaking ties alphabetically. */
export function sortAgents(agents: Agent[], key: AgentSortKey): Agent[] {
  const byName = (left: Agent, right: Agent) => left.name.localeCompare(right.name, 'ca')
  switch (key) {
    case 'name':
      return sortAgentsByName(agents)
    case 'work':
      return [...agents].sort((left, right) => right.used - left.used || byName(left, right))
    case 'capacity':
      return [...agents].sort(
        (left, right) => right.max - right.used - (left.max - left.used) || byName(left, right),
      )
    default:
      return sortAgentsByPresence(agents)
  }
}

export function totalSkillBacklog(skills: Skill[]): number {
  return skills.reduce((total, skill) => total + skill.backlog, 0)
}

function sortSkillsByBacklog(skills: Skill[]): Skill[] {
  return [...skills].sort((left, right) => {
    const backlogDiff = right.backlog - left.backlog
    if (backlogDiff !== 0) {
      return backlogDiff
    }
    return left.name.localeCompare(right.name, 'ca')
  })
}

/** Label used for skills without a SkillType. */
const SKILL_TYPE_FALLBACK = 'Sense tipus'

const UNTYPED_GROUP_KEY = '__untyped__'

export interface SkillTypeGroup {
  typeId: string | null
  type: string
  skills: Skill[]
  backlog: number
}

/**
 * Group skills by their Salesforce SkillType ID. Skills within each group keep the
 * backlog-first ordering; groups themselves are ordered by total backlog, with the
 * untyped group always last.
 */
export function groupSkillsByType(skills: Skill[]): SkillTypeGroup[] {
  const byTypeId = new Map<string, Skill[]>()
  for (const skill of skills) {
    const key = skill.typeId ?? UNTYPED_GROUP_KEY
    const bucket = byTypeId.get(key)
    if (bucket) {
      bucket.push(skill)
    } else {
      byTypeId.set(key, [skill])
    }
  }

  const groups: SkillTypeGroup[] = [...byTypeId.entries()].map(([key, groupSkills]) => ({
    typeId: key === UNTYPED_GROUP_KEY ? null : key,
    type:
      key === UNTYPED_GROUP_KEY
        ? SKILL_TYPE_FALLBACK
        : (groupSkills[0]?.type ?? SKILL_TYPE_FALLBACK),
    skills: sortSkillsByBacklog(groupSkills),
    backlog: totalSkillBacklog(groupSkills),
  }))

  return groups.sort((left, right) => {
    const leftFallback = left.typeId === null
    const rightFallback = right.typeId === null
    if (leftFallback !== rightFallback) {
      return leftFallback ? 1 : -1
    }
    const backlogDiff = right.backlog - left.backlog
    if (backlogDiff !== 0) {
      return backlogDiff
    }
    return left.type.localeCompare(right.type, 'ca')
  })
}

export interface WorkStatusCounts {
  assigned: number
  queued: number
}

export function countWorkByStatus(work: WorkItem[]): WorkStatusCounts {
  return work.reduce<WorkStatusCounts>(
    (counts, item) => {
      counts[item.status] += 1
      return counts
    },
    { assigned: 0, queued: 0 },
  )
}

function sortWorkByAge(work: WorkItem[]): WorkItem[] {
  return [...work].sort((left, right) => right.ageSec - left.ageSec)
}

const UNGROUPED_KEY = '__ungrouped__'

/** Criteria the work panel can group its cards by. */
export type WorkGroupBy = 'queue' | 'agent' | 'channel' | 'status'

export interface WorkGroup {
  /** Grouping value (queueId, agentId, channelKey, status), or null for the fallback bucket. */
  key: string | null
  items: WorkItem[]
  counts: WorkStatusCounts
  oldestAgeSec: number
}

function workGroupKey(item: WorkItem, groupBy: WorkGroupBy): string | null {
  switch (groupBy) {
    case 'queue':
      return item.queueId
    case 'agent':
      return item.agentId
    case 'channel':
      return item.channelKey
    default:
      return item.status
  }
}

/**
 * Group work items by the chosen criterion. Items within each group go
 * oldest-first (the urgent end); groups themselves are ordered by their oldest
 * item so whatever has been waiting longest surfaces first. Items with no value
 * for the criterion (e.g. an unassigned item grouped by agent) collapse into a
 * trailing null-key group.
 */
export function groupWork(work: WorkItem[], groupBy: WorkGroupBy): WorkGroup[] {
  const byKey = new Map<string, WorkItem[]>()
  for (const item of work) {
    const key = workGroupKey(item, groupBy) ?? UNGROUPED_KEY
    const bucket = byKey.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      byKey.set(key, [item])
    }
  }

  const groups: WorkGroup[] = [...byKey.entries()].map(([key, groupItems]) => {
    const items = sortWorkByAge(groupItems)
    return {
      key: key === UNGROUPED_KEY ? null : key,
      items,
      counts: countWorkByStatus(items),
      oldestAgeSec: items[0]?.ageSec ?? 0,
    }
  })

  return groups.sort((left, right) => {
    const leftFallback = left.key === null
    const rightFallback = right.key === null
    if (leftFallback !== rightFallback) {
      return leftFallback ? 1 : -1
    }
    return right.oldestAgeSec - left.oldestAgeSec
  })
}
