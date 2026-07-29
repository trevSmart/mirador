import { devLog } from '../../dev/dev-log'
import type { MiradorClient } from '../mirador-client'
import type {
  AgentScope,
  AgentsResponse,
  MessagingTranscript,
  RecordDetail,
  RecordDetailsRequest,
  RecordDetailsResponse,
  SnapshotResponse,
} from '../types'
import { loadMockSpacePlan, saveMockSpacePlan } from '../../space/space-plan-repository'
import { parseStoredSpacePlan, toWireSpacePlan } from '../../space/space-plan-model'
import { MOCK_CAPABILITIES } from './capabilities'
import { getAgentSkills, getMockPresenceStatuses } from './mock-seed'
import { getMockAgentTimeline } from './mock-timeline'
import {
  applyMockSkillChanges,
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

/** Deterministic mock record detail derived from the id, so the drawer can be
    exercised in mock mode. Cases (ids starting with 500) get a CaseNumber;
    messaging sessions (0Mw) get a Subject. Both carry a record status; an id
    containing "CLOSE" renders the type's terminal (closed) state. */
function mockRecordDetail(id: string): RecordDetail {
  const created = new Date(MOCK_RECORD_EPOCH).toISOString()
  const modified = new Date(MOCK_RECORD_EPOCH + 3_600_000).toISOString()
  const isCase = id.startsWith('500')
  const isMessaging = id.startsWith('0Mw')
  return {
    id,
    objectApiName: isCase ? 'Case' : isMessaging ? 'MessagingSession' : null,
    createdDate: created,
    lastModifiedDate: modified,
    caseNumber: isCase ? `0${id.slice(-7)}` : null,
    subject: isMessaging ? 'Sessió de missatgeria (mock)' : null,
    recordStatus: mockRecordStatus(id, isCase, isMessaging),
    recordClosed: isCase || isMessaging ? isMockRecordClosed(id) : null,
    conversationIdentifier: isMessaging ? `mock-conv-${id.slice(-8)}` : null,
    endUserName: isMessaging ? 'Visitant (mock)' : null,
  }
}

/* Whether a mock record reads as closed. Tests pin the state with a "CLOSE" /
   "OPEN" marker in the id; seed-generated ids (all digits) instead alternate by
   the parity of their numeric block, so a demo shows both open and closed. */
function isMockRecordClosed(id: string): boolean {
  if (id.includes('CLOSE')) return true
  if (id.includes('OPEN')) return false
  const digits = id.replace(/\D/g, '')
  return digits.length > 0 && Number(digits[digits.length - 1]) % 2 === 0
}

/* Both Case and MessagingSession carry a real record status in the org, so the
   mock mirrors that: a closed record yields the type's terminal state, an open
   one its live state. Types without a Status field stay null. */
function mockRecordStatus(id: string, isCase: boolean, isMessaging: boolean): string | null {
  const closed = isMockRecordClosed(id)
  if (isCase) return closed ? 'Closed' : 'New'
  if (isMessaging) return closed ? 'Ended' : 'Active'
  return null
}

const MOCK_RECORD_EPOCH = Date.UTC(2026, 0, 15, 9, 30)

function mockMessagingTranscript(sessionId: string): MessagingTranscript {
  const closed = isMockRecordClosed(sessionId)
  const base = MOCK_RECORD_EPOCH + 120_000
  return {
    messagingSessionId: sessionId,
    conversationIdentifier: `mock-conv-${sessionId.slice(-8)}`,
    endUserName: 'Visitant (mock)',
    sessionStatus: closed ? 'Ended' : 'Active',
    entries: [
      {
        identifier: `${sessionId}-1`,
        messageText: 'bona tarda',
        clientTimestamp: base,
        serverReceivedTimestamp: base + 50,
        senderRole: 'EndUser',
        senderSubject: 'mock-end-user',
      },
      {
        identifier: `${sessionId}-2`,
        messageText: 'Hola! En què et puc ajudar?',
        clientTimestamp: base + 4_000,
        serverReceivedTimestamp: base + 4_050,
        senderRole: 'Agent',
        senderSubject: '005000000000001AAA',
      },
      {
        identifier: `${sessionId}-3`,
        messageText: 'Tinc un dubte amb la meva comanda',
        clientTimestamp: base + 9_000,
        serverReceivedTimestamp: base + 9_040,
        senderRole: 'EndUser',
        senderSubject: 'mock-end-user',
      },
    ],
  }
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
    getAgentTimeline: (userId, day) =>
      withApiLog('GET', `/agents/${userId}/timeline?day=${day}`, () => ({
        timeline: getMockAgentTimeline(userId, day),
      })),
    updateAgentSkills: (userId, body) =>
      withApiLog('PUT', `/agents/${userId}/skills`, () => {
        applyMockSkillChanges(userId, body?.changes ?? [])
        return { ok: true }
      }),
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
          presenceStatuses: getMockPresenceStatuses(),
        } satisfies SnapshotResponse
      }),
    getRecordDetails: (body: RecordDetailsRequest) =>
      withApiLog('POST', '/records/details', () => ({
        records: body.ids.map(mockRecordDetail),
      } satisfies RecordDetailsResponse)),
    getMessagingTranscript: (sessionId, opts) =>
      withApiLog(
        'GET',
        `/messaging-sessions/${sessionId}/transcript`,
        () => {
          if (!sessionId.startsWith('0Mw')) {
            throw new Error('Invalid messaging session id')
          }
          const transcript = mockMessagingTranscript(sessionId)
          if (opts?.conversationIdentifier) {
            transcript.conversationIdentifier = opts.conversationIdentifier
          }
          return transcript
        },
      ),
    getSpacePlan: () =>
      withApiLog('GET', '/space-plan', async () => {
        const plan = await loadMockSpacePlan()
        return plan ? toWireSpacePlan(plan) : null
      }),
    saveSpacePlan: (plan) =>
      withApiLog('PUT', '/space-plan', () => {
        const parsed = parseStoredSpacePlan(plan)
        return parsed ? saveMockSpacePlan(parsed) : Promise.resolve()
      }),
  }
}
