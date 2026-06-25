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

/** Registra l'inici i el final (amb durada) d'una crida mock, igual que el client real. */
async function withApiLog<T>(
  method: string,
  path: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  devLog.api(method, path, 'iniciant… (mock)')
  const result = await fn()
  const elapsed = Date.now() - startedAt
  devLog.api(method, path, `200 · ${elapsed}ms (mock)`)
  return result
}

export function createMockMiradorClient(): MiradorClient {
  return {
    getCapabilities: () =>
      withApiLog('GET', '/capabilities', () => MOCK_CAPABILITIES),
    getAgents: (scope: AgentScope = 'connected') =>
      withApiLog('GET', `/agents?scope=${scope}`, () => {
        const roster = getMockAgents()
        const filtered =
          scope === 'connected'
            ? roster.filter((agent) => agent.status !== 'offline')
            : roster
        return { agents: filtered } satisfies AgentsResponse
      }),
    getAgentSkills: (userId) =>
      withApiLog('GET', `/agents/${userId}/skills`, () => ({
        skills: getAgentSkills(userId),
      })),
    updateAgentSkills: (userId) =>
      withApiLog('PUT', `/agents/${userId}/skills`, () => ({
        ok: true,
      })),
    getSkillAgents: (skillId) =>
      withApiLog('GET', `/skills/${skillId}/agents`, () => ({
        agents: getMockSkillAgents(skillId),
      })),
    getQueues: () =>
      withApiLog('GET', '/queues', () => ({ queues: getMockQueues() })),
    getSkills: () =>
      withApiLog('GET', '/skills', () => ({ skills: getMockSkills() })),
    getWork: () =>
      withApiLog('GET', '/work', () => ({ work: getMockWork() })),
    getSnapshot: (scope: AgentScope = 'all') =>
      withApiLog('GET', `/snapshot?scope=${scope}`, () => {
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
      }),
  }
}
