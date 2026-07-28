import { describe, expect, it } from 'vitest'
import {
  computeHardRanges,
  coordRange,
  feasible,
  moveTo,
  step,
  sum,
} from './allocator-engine'
import type { SkillProfile } from './allocator-types'

/** Fixture matching the handoff prototype skill graph (§9), with a feasible start. */
const TOTAL = 300
const PROFILES: SkillProfile[] = [
  { id: '0', cap: 15, skills: [0] },
  { id: '01', cap: 170, skills: [0, 1] },
  { id: '12', cap: 20, skills: [1, 2] },
  { id: '234', cap: 65, skills: [2, 3, 4] },
  { id: 'all', cap: 30, skills: [0, 1, 2, 3, 4] },
]
const NQ = 5
const UNLOCKED = [false, false, false, false, false]
/** Feasible seed (the handoff's [30,150,25,55,40] violates {2,3,4} ≤ 115). */
const SEED = [50, 135, 25, 45, 45]

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

describe('capacity allocator engine', () => {
  it('keeps sum invariant and non-negativity across 20k random drag sequences', () => {
    const rand = mulberry32(42)
    let x = SEED.slice()
    expect(sum(x)).toBe(TOTAL)
    expect(feasible(x, PROFILES, NQ)).toBe(true)

    for (let i = 0; i < 20_000; i++) {
      const qi = Math.floor(rand() * NQ)
      const target = Math.floor(rand() * (TOTAL + 1))
      x = moveTo(x, qi, target, UNLOCKED, PROFILES, TOTAL)
      expect(sum(x)).toBe(TOTAL)
      expect(x.every((v) => v >= 0)).toBe(true)
      expect(feasible(x, PROFILES, NQ)).toBe(true)
    }
  })

  it('spreads freed agents across all others when lowering a sole-staffed queue', () => {
    // From [0, total, 0, 0, 0], lower the big queue — freed agents must spread
    // evenly, not pile onto one arbitrary queue.
    let x = [0, TOTAL, 0, 0, 0]
    // Make this state feasible by using profiles that allow everything on queue 1.
    const openProfiles: SkillProfile[] = [
      { id: 'all', cap: TOTAL, skills: [0, 1, 2, 3, 4] },
    ]
    expect(feasible(x, openProfiles, NQ)).toBe(true)

    x = moveTo(x, 1, TOTAL - 40, UNLOCKED, openProfiles, TOTAL)
    expect(sum(x)).toBe(TOTAL)
    expect(x[1]).toBe(TOTAL - 40)
    const others = [x[0], x[2], x[3], x[4]]
    expect(sum(others)).toBe(40)
    // Spread: no single other queue should take all 40.
    expect(Math.max(...others)).toBeLessThan(40)
    // Every other queue should have received something.
    expect(others.every((v) => v > 0)).toBe(true)
  })

  it('matches brute-force enumeration for coordRange on small instances', () => {
    const total = 8
    const nQ = 3
    const profiles: SkillProfile[] = [
      { id: 'a', cap: 3, skills: [0] },
      { id: 'b', cap: 3, skills: [0, 1] },
      { id: 'c', cap: 2, skills: [1, 2] },
    ]
    const locked = [false, false, false]
    const x = [3, 3, 2]
    expect(sum(x)).toBe(total)
    expect(feasible(x, profiles, nQ)).toBe(true)

    for (let i = 0; i < nQ; i++) {
      const [lo, hi] = coordRange(x, i, locked, profiles, total)
      const brute = bruteFeasibleRange(x, i, locked, profiles, total, nQ)
      expect([lo, hi]).toEqual(brute)
    }
  })

  it('never drops an exclusive-skill queue below its hard floor', () => {
    // Queue 0 exclusive cohort of 15 → hard floor = total − f({1,2,3,4}) = 15.
    const hard = computeHardRanges(PROFILES, TOTAL, NQ)
    const [hLo] = hard[0]
    expect(hLo).toBe(15)

    let x = SEED.slice()
    expect(feasible(x, PROFILES, NQ)).toBe(true)
    x = moveTo(x, 0, 0, UNLOCKED, PROFILES, TOTAL)
    expect(x[0]).toBeGreaterThanOrEqual(hLo)
    expect(x[0]).toBe(hLo)
  })

  it('never produces fractional agent counts after moveTo', () => {
    const rand = mulberry32(7)
    let x = SEED.slice()
    for (let i = 0; i < 500; i++) {
      const qi = Math.floor(rand() * NQ)
      // Fractional targets must snap to integers before state update.
      const target = rand() * TOTAL
      x = moveTo(x, qi, target, UNLOCKED, PROFILES, TOTAL)
      expect(x.every((v) => Number.isInteger(v))).toBe(true)
      expect(sum(x)).toBe(TOTAL)
    }
  })

  it('step returns null when locked peers block every swap', () => {
    const x = SEED.slice()
    const locked = [false, true, true, true, true]
    expect(step(x, 0, 1, locked, PROFILES, TOTAL)).toBeNull()
  })
})

/**
 * Enumerate every feasible integer allocation that respects locks (locked
 * queues fixed at `x`) and report the min/max of coordinate `i`.
 * For unlocked graphs this matches the step-reachable range from `x`.
 */
function bruteFeasibleRange(
  x: number[],
  i: number,
  locked: boolean[],
  profiles: SkillProfile[],
  total: number,
  nQ: number,
): [number, number] {
  if (locked[i]) return [x[i], x[i]]
  let lo = Infinity
  let hi = -Infinity
  const recurse = (partial: number[], idx: number, remaining: number) => {
    if (idx === nQ - 1) {
      partial[idx] = remaining
      if (!feasible(partial, profiles, nQ)) return
      for (let q = 0; q < nQ; q++) {
        if (locked[q] && partial[q] !== x[q]) return
      }
      lo = Math.min(lo, partial[i])
      hi = Math.max(hi, partial[i])
      return
    }
    for (let v = 0; v <= remaining; v++) {
      if (locked[idx] && v !== x[idx]) continue
      partial[idx] = v
      recurse(partial, idx + 1, remaining - v)
    }
  }
  recurse(Array.from({ length: nQ }, () => 0), 0, total)
  return [lo, hi]
}
