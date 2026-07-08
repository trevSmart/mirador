import type { Agent, Queue, Skill, WorkItem } from '../api/types'
import type { DetailTarget } from './detail-drawer-context'

export interface MiradorEntityData {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
}

export const FALLBACK_TITLE: Record<DetailTarget['kind'], string> = {
  agent: 'Agent',
  queue: 'Cua',
  skill: 'Skill',
  work: 'Treball',
}

export function resolveDetailTitle(target: DetailTarget, data: MiradorEntityData): string {
  switch (target.kind) {
    case 'agent':
      return data.agents.find((agent) => agent.id === target.id)?.name ?? FALLBACK_TITLE.agent
    case 'queue':
      return data.queues.find((queue) => queue.id === target.id)?.name ?? FALLBACK_TITLE.queue
    case 'skill':
      return data.skills.find((skill) => skill.id === target.id)?.name ?? FALLBACK_TITLE.skill
    case 'work':
      return data.work.find((item) => item.id === target.id)?.subject ?? FALLBACK_TITLE.work
  }
}
