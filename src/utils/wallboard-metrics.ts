/* Wallboard metrics — derives the standard Omni Supervisor "Wallboard" tab
   figures from the Mirador snapshot.

   Some Omni-Supervisor metrics have no source in the Mirador snapshot
   (Raised Flags, the historical Agent Work Status counters, the Work
   Performance averages). For those we synthesise plausible numbers, but only
   in mock mode — in a real Salesforce connection they fall back to zero / "no
   data", mirroring how the standard wallboard shows empty charts until data
   flows in.

   The mock figures are *deterministic*: they are seeded from the live snapshot
   (agent count, total work, capacity), so they evolve naturally as the mock
   contact center changes on each refresh, yet never flicker randomly on a
   hot-reload. */

import type { Agent, Queue, WorkItem } from '../api/types'
import { presenceLabel } from './format'

/* ── Card 1 · Work Item Status ─────────────────────────────────────────── */

export interface WorkItemStatusBucket {
  label: string
  value: number
}

export function workItemStatus(work: WorkItem[]): WorkItemStatusBucket[] {
  let assigned = 0
  let queued = 0
  for (const item of work) {
    if (item.status === 'assigned') assigned += 1
    else queued += 1
  }
  // The standard chart only draws when there is data; an all-zero result lets
  // the card render the SLDS "no data" placeholder, exactly like the image.
  if (assigned === 0 && queued === 0) return []
  return [
    { label: 'Assigned', value: assigned },
    { label: 'Queued', value: queued },
  ]
}

/* ── Card 2 · Agent Primary Capacity Status ────────────────────────────── */

type CapacityStatusKey = 'Online' | 'Idle' | 'Busy' | 'At Capacity' | 'Offline'

export interface CapacityStatusBucket {
  label: CapacityStatusKey
  value: number
}

/** Maps a Mirador agent onto the five Omni capacity-status buckets. */
function capacityStatusOf(agent: Agent): CapacityStatusKey {
  if (agent.status === 'offline') return 'Offline'
  if (agent.status === 'away') return 'Idle'
  if (agent.max > 0 && agent.used >= agent.max) return 'At Capacity'
  if (agent.status === 'busy') return 'Busy'
  return 'Online'
}

export function capacityStatus(agents: Agent[]): CapacityStatusBucket[] {
  const order: CapacityStatusKey[] = ['Online', 'Idle', 'Busy', 'At Capacity', 'Offline']
  const counts = new Map<CapacityStatusKey, number>(order.map((k) => [k, 0]))
  for (const agent of agents) {
    const key = capacityStatusOf(agent)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return order.map((label) => ({ label, value: counts.get(label) ?? 0 }))
}

/* ── Card 4 · Agent Primary Capacity (donut) ───────────────────────────── */

export interface UsedCapacity {
  /** 0..1 ratio of consumed capacity across connected agents. */
  ratio: number
  used: number
  max: number
}

export function usedCapacity(agents: Agent[]): UsedCapacity {
  let used = 0
  let max = 0
  for (const agent of agents) {
    if (agent.status === 'offline') continue
    used += agent.used
    max += agent.max
  }
  return { ratio: max > 0 ? used / max : 0, used, max }
}

/* ── Card 5 · Agent Presence Statuses ──────────────────────────────────── */

export interface PresenceBucket {
  label: string
  value: number
}

/** Counts agents per presence status, sorted by descending count (as the
    standard horizontal-bar chart does). */
export function presenceStatuses(agents: Agent[]): PresenceBucket[] {
  const counts = new Map<string, number>()
  for (const agent of agents) {
    const label = presenceLabel(agent.status)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

/* ── Card 3 · Wait Time ────────────────────────────────────────────────── */

export interface WaitTime {
  /** Average wait across queued work, in seconds. null → render "—". */
  averageSec: number | null
  /** Longest current wait, in seconds. null → render "—". */
  longestSec: number | null
}

export function waitTime(queues: Queue[], work: WorkItem[]): WaitTime {
  const queued = work.filter((item) => item.status === 'queued')
  if (queued.length === 0 && queues.every((q) => q.backlog === 0)) {
    return { averageSec: null, longestSec: null }
  }
  // Prefer the actual queued work-item ages; fall back to queue aggregates.
  if (queued.length > 0) {
    const total = queued.reduce((sum, item) => sum + item.ageSec, 0)
    const longest = queued.reduce((m, item) => Math.max(m, item.ageSec), 0)
    return { averageSec: Math.round(total / queued.length), longestSec: longest }
  }
  const avg = queues.reduce((sum, q) => sum + q.avg, 0) / Math.max(1, queues.length)
  const longest = queues.reduce((m, q) => Math.max(m, q.longest), 0)
  return { averageSec: Math.round(avg), longestSec: longest }
}

/* ── Deterministic mock helpers ────────────────────────────────────────── */

/** Tiny deterministic PRNG (mulberry32) seeded from the live snapshot so mock
    figures drift with the data yet stay stable across re-renders. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function snapshotSeed(agents: Agent[], work: WorkItem[]): number {
  const usedSum = agents.reduce((s, a) => s + a.used, 0)
  return agents.length * 1000 + work.length * 31 + usedSum * 7
}

/* ── Card 6 · Raised Flags ─────────────────────────────────────────────── */

/** No source in the snapshot. Mock: a small count derived from at-capacity
    pressure. Real mode: always 0 (matches the image). */
export function raisedFlags(agents: Agent[], isMock: boolean): number {
  if (!isMock) return 0
  const atCapacity = agents.filter((a) => a.max > 0 && a.used >= a.max).length
  const rng = seededRandom(snapshotSeed(agents, []) + atCapacity)
  return Math.round(atCapacity * (rng() * 0.6))
}

/* ── Card 7 · Agent Work Status (Last Hour) ────────────────────────────── */

export interface WorkStatusBucket {
  label: string
  value: number
}

const WORK_STATUS_LABELS = [
  'Assigned',
  'Opened',
  'Closed',
  'Declined',
  'Push Timeout',
  'Canceled',
] as const

export function agentWorkStatus(
  agents: Agent[],
  work: WorkItem[],
  isMock: boolean,
): WorkStatusBucket[] {
  if (!isMock) {
    return WORK_STATUS_LABELS.map((label) => ({ label, value: 0 }))
  }
  const rng = seededRandom(snapshotSeed(agents, work))
  const base = work.length || agents.length
  const assigned = base + Math.round(rng() * base * 0.5)
  return [
    { label: 'Assigned', value: assigned },
    { label: 'Opened', value: Math.round(assigned * (0.7 + rng() * 0.2)) },
    { label: 'Closed', value: Math.round(assigned * (0.5 + rng() * 0.3)) },
    { label: 'Declined', value: Math.round(assigned * (rng() * 0.12)) },
    { label: 'Push Timeout', value: Math.round(assigned * (rng() * 0.08)) },
    { label: 'Canceled', value: Math.round(assigned * (rng() * 0.05)) },
  ]
}

/* ── Card 8 · Work Performance (Last Hour) ─────────────────────────────── */

export interface WorkPerformance {
  /** seconds, null → "—" */
  avgWorkHandleSec: number | null
  avgSpeedToAnswerSec: number | null
  avgActiveWorkSec: number | null
  afterConversationSec: number | null
}

export function workPerformance(
  agents: Agent[],
  work: WorkItem[],
  isMock: boolean,
): WorkPerformance {
  if (!isMock) {
    return {
      avgWorkHandleSec: null,
      avgSpeedToAnswerSec: null,
      avgActiveWorkSec: null,
      afterConversationSec: null,
    }
  }
  const rng = seededRandom(snapshotSeed(agents, work) + 13)
  return {
    avgWorkHandleSec: Math.round(180 + rng() * 240),
    avgSpeedToAnswerSec: Math.round(15 + rng() * 45),
    avgActiveWorkSec: Math.round(120 + rng() * 180),
    afterConversationSec: Math.round(20 + rng() * 60),
  }
}
