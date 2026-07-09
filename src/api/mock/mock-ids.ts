/**
 * Deterministic Salesforce-style 18-char Ids for mock mode.
 * Layout: 3-char key prefix + "mock" + 8-digit sequence + "AAA" (15 + suffix).
 * Same prefixes as a real org so UI behaviour (e.g. colorFromRecordId) matches production.
 */

export function mockSfId(prefix: string, seq: number): string {
  return `${prefix}mock${String(seq).padStart(8, '0')}AAA`
}

/** Omni-Channel queue (Group) — key prefix 00G. */
export const MOCK_QUEUE = {
  ac: mockSfId('00G', 1),
  in: mockSfId('00G', 2),
  ve: mockSfId('00G', 3),
  st: mockSfId('00G', 4),
  re: mockSfId('00G', 5),
} as const

export type MockQueueKey = keyof typeof MOCK_QUEUE

export const MOCK_QUEUE_KEYS = Object.keys(MOCK_QUEUE) as MockQueueKey[]

export const MOCK_QUEUE_ID_LIST: readonly string[] = MOCK_QUEUE_KEYS.map((key) => MOCK_QUEUE[key])

/** SkillType metadata — key prefix 0C1. */
export const MOCK_SKILL_TYPE = {
  Language: mockSfId('0C1', 1),
  Expertise: mockSfId('0C1', 2),
  Certification: mockSfId('0C1', 3),
} as const

/** Omni-Channel Skill — key prefix 0C5. */
export const MOCK_SKILL = {
  ca: mockSfId('0C5', 1),
  es: mockSfId('0C5', 2),
  en: mockSfId('0C5', 3),
  fr: mockSfId('0C5', 4),
  de: mockSfId('0C5', 5),
  tec: mockSfId('0C5', 6),
  tec3: mockSfId('0C5', 7),
  ven: mockSfId('0C5', 8),
  ret: mockSfId('0C5', 9),
  med: mockSfId('0C5', 10),
  acc: mockSfId('0C5', 11),
  gdpr: mockSfId('0C5', 12),
} as const

export type MockSkillKey = keyof typeof MOCK_SKILL

/** User (agent) — key prefix 005. Keys a0…a41 match mock-seed agent specs. */
function buildMockAgents(): Record<string, string> {
  const agents: Record<string, string> = {}
  for (let i = 0; i <= 41; i += 1) {
    agents[`a${i}`] = mockSfId('005', i + 1)
  }
  return agents
}

export const MOCK_AGENT = buildMockAgents() as Record<`a${number}`, string>

export type MockAgentKey = keyof typeof MOCK_AGENT

/** ServicePresenceStatus — key prefix 0N5. */
export const MOCK_PRESENCE = {
  available: mockSfId('0N5', 1),
  availableVoice: mockSfId('0N5', 2),
  busy: mockSfId('0N5', 3),
  away: mockSfId('0N5', 4),
  lunch: mockSfId('0N5', 5),
  meeting: mockSfId('0N5', 6),
  offline: mockSfId('0N5', 7),
} as const

/** AgentWork / PendingServiceRouting row — key prefix 0Bz. */
export function mockWorkItemId(seq: number): string {
  return mockSfId('0Bz', seq)
}

/** ServiceResourceSkill assignment — key prefix 0C6. */
export function mockServiceResourceSkillId(agentSeq: number, assignmentIndex: number): string {
  return mockSfId('0C6', agentSeq * 100 + assignmentIndex + 1)
}

/**
 * The backing SObject id for a work item of a given channel, so the drawer's
 * record-detail lookup resolves in mock mode. Cases (cas/email) → 500…,
 * messaging (chat/wa) → 0Mw…; voice has no status-bearing record here → null.
 * Deterministic in `seq` so the same work item always maps to the same record.
 */
export function mockRecordIdForChannel(channelKey: string, seq: number): string | null {
  if (channelKey === 'cas' || channelKey === 'email') return mockSfId('500', seq)
  if (channelKey === 'chat' || channelKey === 'wa') return mockSfId('0Mw', seq)
  return null
}

/** Numeric suffix from mock agent key "a0" → 0, "a41" → 41. */
export function mockAgentSeq(agentKey: MockAgentKey): number {
  return Number.parseInt(agentKey.slice(1), 10)
}
