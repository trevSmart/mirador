import type {
  AgentTimeline,
  ChannelKey,
  PresenceSegment,
  PresenceStatus,
  WorkSegment,
} from '../types'
import { presenceLabel } from '../../utils/format'
import { agents, resolvePresenceStatus } from './mock-seed'
import { MOCK_AGENT, mockAgentSeq, mockWorkItemId, type MockAgentKey } from './mock-ids'

/* Deterministic per-day agent timeline for mock mode. There is no real
   historical feed yet (the Apex only captures the *current* state), so we
   synthesize a believable day of presence bands + work bars from the seeded
   roster. Same (agentId, day, now) → same output, so tests are stable while the
   app still looks live (the mock client passes Date.now()). */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Small deterministic RNG (mulberry32) seeded from the agent + day. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Midnight (local) of an ISO date, e.g. "2026-07-09" → local 00:00 epoch ms. */
function dayStartMs(dayISO: string): number {
  const [y, m, d] = dayISO.split('-').map((n) => Number.parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime()
}

/** Numeric day key so the RNG re-rolls per day but stays stable within a day. */
function dayKey(dayISO: string): number {
  let k = 0
  for (let i = 0; i < dayISO.length; i += 1) {
    k = (k * 31 + dayISO.charCodeAt(i)) | 0
  }
  return k
}

const iso = (ms: number) => new Date(ms).toISOString()

/** Presence categories an active agent cycles through during the day, weighted
    toward "online" so the day reads as mostly available. */
const PRESENCE_CYCLE: PresenceStatus[] = [
  'online',
  'busy',
  'online',
  'away',
  'online',
  'busy',
  'online',
]

function findAgentKey(agentId: string): MockAgentKey | undefined {
  const entry = Object.entries(MOCK_AGENT).find(([, id]) => id === agentId)
  return entry?.[0] as MockAgentKey | undefined
}

const EMPTY_TIMELINE = (agentId: string, day: string): AgentTimeline => ({
  agentId,
  day,
  presence: [],
  work: [],
})

/**
 * Build a deterministic day timeline for one agent. `nowMs` anchors "now": on
 * today it caps the window and leaves the last band/active work ongoing
 * (`end: null`); on a past day the window closes at a fixed workday end.
 */
export function buildAgentTimeline(
  agentId: string,
  dayISO: string,
  nowMs: number,
): AgentTimeline {
  const agent = agents.find((a) => a.id === agentId)
  if (!agent || agent.status === 'offline') {
    return EMPTY_TIMELINE(agentId, dayISO)
  }

  const key = findAgentKey(agentId)
  const seq = key ? mockAgentSeq(key) : 0
  const rand = makeRng((seq + 1) * 7919 + dayKey(dayISO))

  const dayStart = dayStartMs(dayISO)
  const isToday = nowMs >= dayStart && nowMs < dayStart + 24 * HOUR
  const windowEnd = isToday ? nowMs : dayStart + 18 * HOUR

  // Log-in somewhere between 08:00 and 09:30, clamped so there's always room
  // for at least one short band before "now".
  let login = dayStart + 8 * HOUR + Math.floor(rand() * 90) * MINUTE
  if (login >= windowEnd - 15 * MINUTE) {
    login = windowEnd - 15 * MINUTE
  }

  const presence = buildPresence(rand, login, windowEnd, isToday)
  const work = buildWork(agent.work, seq, rand, login, windowEnd, isToday, nowMs)

  return { agentId, day: dayISO, presence, work }
}

function buildPresence(
  rand: () => number,
  login: number,
  windowEnd: number,
  isToday: boolean,
): PresenceSegment[] {
  const bands: PresenceSegment[] = []
  let cursor = login
  let i = 0
  while (cursor < windowEnd && i < 40) {
    const category = PRESENCE_CYCLE[i % PRESENCE_CYCLE.length]
    const durMin = 15 + Math.floor(rand() * 60) // 15–74 min
    const rawEnd = cursor + durMin * MINUTE
    const end = Math.min(rawEnd, windowEnd)
    const option = resolvePresenceStatus(category, null, rand)
    const isLast = rawEnd >= windowEnd
    bands.push({
      id: `pres-${i}-${cursor}`,
      start: iso(cursor),
      end: isLast && isToday ? null : iso(end),
      label: option?.label ?? presenceLabel(category),
      status: category,
      presenceLabel: option?.label ?? presenceLabel(category),
    })
    cursor = end
    i += 1
  }
  return bands
}

function buildWork(
  agentWork: { channelKey: ChannelKey; subject: string | null; label: string; queue: string | null; recordId: string | null; ageMin: number }[],
  seq: number,
  rand: () => number,
  login: number,
  windowEnd: number,
  isToday: boolean,
  nowMs: number,
): WorkSegment[] {
  const segments: WorkSegment[] = []
  let n = seq * 1000 + 1

  // Active work: anchored to its real age — an item open for `ageMin` minutes
  // started that long ago and is still ongoing (end: null on today).
  agentWork.forEach((item, idx) => {
    const start = Math.max(login, windowEnd - item.ageMin * MINUTE)
    segments.push({
      id: mockWorkItemId(n++),
      start: iso(start),
      end: isToday ? null : iso(windowEnd),
      label: item.subject || item.label,
      channelKey: item.channelKey,
      recordId: item.recordId,
      queue: item.queue,
    })
    // A completed earlier occurrence on the same channel, to fill the morning.
    if (rand() < 0.6) {
      const span = Math.max(15 * MINUTE, windowEnd - login)
      const cStart = login + Math.floor(rand() * span * 0.6)
      const cEnd = cStart + (3 + Math.floor(rand() * 30)) * MINUTE
      if (cEnd < windowEnd && cEnd <= nowMs) {
        segments.push({
          id: mockWorkItemId(n++),
          start: iso(cStart),
          end: iso(cEnd),
          label: item.subject || item.label,
          channelKey: item.channelKey,
          recordId: null,
          queue: item.queue,
        })
      }
    }
    void idx
  })

  return segments.sort((a, b) => a.start.localeCompare(b.start))
}

/** Public entry point, mirroring getAgentSkills. The mock client supplies
    `Date.now()`; tests can call buildAgentTimeline directly for determinism. */
export function getMockAgentTimeline(
  agentId: string,
  dayISO: string,
  nowMs: number = Date.now(),
): AgentTimeline {
  return buildAgentTimeline(agentId, dayISO, nowMs)
}
