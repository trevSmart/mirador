import { devLog } from '../../dev/dev-log'
import type { MiradorClient } from '../mirador-client'
import type {
  AgentScope,
  AgentSkillsResponse,
  AgentsResponse,
  QueuesResponse,
  SkillAgentsResponse,
  SkillsResponse,
  SnapshotResponse,
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
    getCapabilities: async () => {
      devLog.api('GET', '/capabilities', 'mock')
      return MOCK_CAPABILITIES
    },
    getAgents: async (scope: AgentScope = 'connected') => {
      devLog.api('GET', `/agents?scope=${scope}`, 'mock')
      const roster = getMockAgents()
      const filtered =
        scope === 'connected'
          ? roster.filter((agent) => agent.status !== 'offline')
          : roster
      return { agents: filtered } satisfies AgentsResponse
    },
    getAgentSkills: async (userId) => {
      devLog.api('GET', `/agents/${userId}/skills`, 'mock')
      return { skills: getAgentSkills(userId) } satisfies AgentSkillsResponse
    },
    updateAgentSkills: async (userId) => {
      devLog.api('PUT', `/agents/${userId}/skills`, 'mock')
      return { ok: true } satisfies UpdateSkillsResponse
    },
    getSkillAgents: async (skillId) => {
      devLog.api('GET', `/skills/${skillId}/agents`, 'mock')
      return { agents: getMockSkillAgents(skillId) } satisfies SkillAgentsResponse
    },
    getQueues: async () => {
      devLog.api('GET', '/queues', 'mock')
      return { queues: getMockQueues() } satisfies QueuesResponse
    },
    getSkills: async () => {
      devLog.api('GET', '/skills', 'mock')
      return { skills: getMockSkills() } satisfies SkillsResponse
    },
    getWork: async () => {
      devLog.api('GET', '/work', 'mock')
      return { work: getMockWork() } satisfies WorkResponse
    },
    getSnapshot: async (scope: AgentScope = 'all') => {
      devLog.api('GET', `/snapshot?scope=${scope}`, 'mock')
      const roster = getMockAgents()
      const agents =
        scope === 'connected'
          ? roster.filter((agent) => agent.status !== 'offline')
          : roster
      return {
        agents,
        queues: getMockQueues(),
        skills: getMockSkills(),
        work: getMockWork(),
      } satisfies SnapshotResponse
    },
  }
}
