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

export function sortSkillsByBacklog(skills: Skill[]): Skill[] {
  return [...skills].sort((left, right) => {
    const backlogDiff = right.backlog - left.backlog
    if (backlogDiff !== 0) {
      return backlogDiff
    }
    return left.name.localeCompare(right.name, 'ca')
  })
}

/** Label used for skills without a SkillType. */
export const SKILL_TYPE_FALLBACK = 'Sense tipus'

export interface SkillTypeGroup {
  type: string
  skills: Skill[]
  backlog: number
}

/**
 * Group skills by their Salesforce SkillType. Skills within each group keep the
 * backlog-first ordering; groups themselves are ordered by total backlog, with the
 * untyped group always last.
 */
export function groupSkillsByType(skills: Skill[]): SkillTypeGroup[] {
  const byType = new Map<string, Skill[]>()
  for (const skill of skills) {
    const type = skill.type ?? SKILL_TYPE_FALLBACK
    const bucket = byType.get(type)
    if (bucket) {
      bucket.push(skill)
    } else {
      byType.set(type, [skill])
    }
  }

  const groups: SkillTypeGroup[] = [...byType.entries()].map(([type, groupSkills]) => ({
    type,
    skills: sortSkillsByBacklog(groupSkills),
    backlog: totalSkillBacklog(groupSkills),
  }))

  return groups.sort((left, right) => {
    const leftFallback = left.type === SKILL_TYPE_FALLBACK
    const rightFallback = right.type === SKILL_TYPE_FALLBACK
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

export function partitionWorkByStatus(work: WorkItem[]): {
  assigned: WorkItem[]
  queued: WorkItem[]
} {
  const sorted = sortWorkByAge(work)
  return {
    assigned: sorted.filter((item) => item.status === 'assigned'),
    queued: sorted.filter((item) => item.status === 'queued'),
  }
}
