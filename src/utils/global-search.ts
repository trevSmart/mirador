import type { Agent, AgentWorkItem, ChannelKey, Queue, Skill } from '../api/types'
import { channelLabel } from './format'

export type SearchItemKind = 'agent' | 'queue' | 'skill' | 'work'

export interface SearchItemRef {
  kind: SearchItemKind
  id: string
}

export interface SearchWorkHit {
  agentId: string
  agentName: string
  title: string
  meta: string
  channelKey: ChannelKey
  searchText: string
}

export interface SearchResults {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  workItems: SearchWorkHit[]
}

function workSearchText(work: AgentWorkItem, agentName: string): string {
  return [work.label, work.subject, work.recordId, work.queue, agentName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function collectWorkItems(agents: Agent[]): SearchWorkHit[] {
  const items: SearchWorkHit[] = []
  for (const agent of agents) {
    if (!Array.isArray(agent.work)) continue
    for (const work of agent.work) {
      items.push({
        agentId: agent.id,
        agentName: agent.name,
        title: work.label || 'Work item',
        meta: work.subject || work.queue || channelLabel(work.channelKey),
        channelKey: work.channelKey,
        searchText: workSearchText(work, agent.name),
      })
    }
  }
  return items
}

export function runGlobalSearch(
  query: string,
  agents: Agent[],
  queues: Queue[],
  skills: Skill[],
): SearchResults {
  const q = query.trim().toLowerCase()
  if (!q) {
    return { agents: [], queues: [], skills: [], workItems: [] }
  }

  const matchedAgents = agents
    .filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q),
    )
    .slice(0, 8)

  const matchedQueues = queues.filter((queue) => queue.name.toLowerCase().includes(q)).slice(0, 6)

  const matchedSkills = skills
    .filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        (skill.type ?? '').toLowerCase().includes(q),
    )
    .slice(0, 6)

  const workItems = collectWorkItems(agents).filter((item) => item.searchText.includes(q)).slice(0, 8)

  return {
    agents: matchedAgents,
    queues: matchedQueues,
    skills: matchedSkills,
    workItems,
  }
}

export function flattenSearchResults(results: SearchResults): SearchItemRef[] {
  return [
    ...results.agents.map((agent) => ({ kind: 'agent' as const, id: agent.id })),
    ...results.workItems.map((item) => ({ kind: 'work' as const, id: item.agentId })),
    ...results.queues.map((queue) => ({ kind: 'queue' as const, id: queue.id })),
    ...results.skills.map((skill) => ({ kind: 'skill' as const, id: skill.id })),
  ]
}
