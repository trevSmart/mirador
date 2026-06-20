import type { MiradorClient } from '../mirador-client'
import type {
  AgentScope,
  AgentSkillsResponse,
  AgentsResponse,
  QueuesResponse,
  SkillAgentsResponse,
  SkillsResponse,
  UpdateSkillsResponse,
  WorkResponse,
} from '../types'
import { MOCK_CAPABILITIES } from './capabilities'
import {
  agents,
  getAgentSkills,
  getSkillAgents,
  queues,
  skills,
  work,
} from './mock-seed'

export function createMockMiradorClient(): MiradorClient {
  return {
    getCapabilities: async () => MOCK_CAPABILITIES,
    getAgents: async (scope: AgentScope = 'connected') => {
      const roster = scope === 'all' ? agents : agents
      return { agents: roster.map((agent) => ({ ...agent, skills: getAgentSkills(agent.id) })) } satisfies AgentsResponse
    },
    getAgentSkills: async (userId) =>
      ({ skills: getAgentSkills(userId) }) satisfies AgentSkillsResponse,
    updateAgentSkills: async () => ({ ok: true }) satisfies UpdateSkillsResponse,
    getSkillAgents: async (skillId) =>
      ({ agents: getSkillAgents(skillId) }) satisfies SkillAgentsResponse,
    getQueues: async () => ({ queues: queues.slice() }) satisfies QueuesResponse,
    getSkills: async () => ({ skills: skills.slice() }) satisfies SkillsResponse,
    getWork: async () => ({ work: work.slice() }) satisfies WorkResponse,
  }
}
