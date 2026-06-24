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
import { getAgentSkills } from './mock-seed'
import {
  getMockAgents,
  getMockQueues,
  getMockSkillAgents,
  getMockSkills,
  getMockWork,
} from './mock-state'

export function createMockMiradorClient(): MiradorClient {
  return {
    getCapabilities: async () => MOCK_CAPABILITIES,
    getAgents: async (scope: AgentScope = 'connected') => {
      const roster = getMockAgents()
      const filtered =
        scope === 'connected'
          ? roster.filter((agent) => agent.status !== 'offline')
          : roster
      return { agents: filtered } satisfies AgentsResponse
    },
    getAgentSkills: async (userId) =>
      ({ skills: getAgentSkills(userId) }) satisfies AgentSkillsResponse,
    updateAgentSkills: async () => ({ ok: true }) satisfies UpdateSkillsResponse,
    getSkillAgents: async (skillId) =>
      ({ agents: getMockSkillAgents(skillId) }) satisfies SkillAgentsResponse,
    getQueues: async () => ({ queues: getMockQueues() }) satisfies QueuesResponse,
    getSkills: async () => ({ skills: getMockSkills() }) satisfies SkillsResponse,
    getWork: async () => ({ work: getMockWork() }) satisfies WorkResponse,
  }
}
