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

export function totalAgentWork(agents: Agent[]): number {
  return agents.reduce((total, agent) => total + agent.used, 0)
}

export function totalQueueBacklog(queues: Queue[]): number {
  return queues.reduce((total, queue) => total + queue.backlog, 0)
}

export function totalQueueOnlineAgents(queues: Queue[]): number {
  return queues.reduce((total, queue) => total + queue.online, 0)
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

export function sortAgentsByName(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => left.name.localeCompare(right.name, 'ca'))
}

export function connectedAgents(agents: Agent[]): Agent[] {
  return agents.filter((agent) => agent.status !== 'offline')
}

export function presencePriority(status: PresenceStatus): number {
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

/** Pick a small set that includes each presence status when available. */
export function pickRepresentativeAgents(agents: Agent[], limit: number): Agent[] {
  if (agents.length <= limit) {
    return sortAgentsByPresence(agents)
  }

  const buckets: Record<PresenceStatus, Agent[]> = {
    online: [],
    busy: [],
    away: [],
    offline: [],
  }
  for (const agent of agents) {
    buckets[agent.status].push(agent)
  }
  for (const status of Object.keys(buckets) as PresenceStatus[]) {
    buckets[status].sort((left, right) => left.name.localeCompare(right.name, 'ca'))
  }

  const picked: Agent[] = []
  const pickedIds = new Set<string>()
  const showcaseOrder: PresenceStatus[] = ['offline', 'away', 'busy', 'online']

  for (const status of showcaseOrder) {
    const next = buckets[status].find((agent) => !pickedIds.has(agent.id))
    if (!next) continue
    picked.push(next)
    pickedIds.add(next.id)
    if (picked.length >= limit) {
      return picked
    }
  }

  for (const agent of sortAgentsByPresence(agents)) {
    if (pickedIds.has(agent.id)) continue
    picked.push(agent)
    pickedIds.add(agent.id)
    if (picked.length >= limit) break
  }

  return picked
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

export function sortWorkByAge(work: WorkItem[]): WorkItem[] {
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
