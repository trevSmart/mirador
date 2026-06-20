import type { Agent, PresenceStatus, Queue } from '../api/types'

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
