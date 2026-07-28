/**
 * Pure capacity-allocator math.
 *
 * Feasibility is Hall's condition over every subset of queues: for any subset S,
 * agents assigned to S cannot exceed agents who can serve at least one queue in S.
 *
 * For n ≤ 12 queues, enumerating 2^n subsets is fine. Above ~14 queues, replace
 * `feasible` with a max-flow computation — the public API stays the same.
 */

import type { DynRange, HardRange, SkillProfile } from './allocator-types'

/** Capacity of agents who can serve at least one queue in `mask`. */
export function fS(profiles: SkillProfile[], mask: number): number {
  return profiles.reduce(
    (sum, p) => sum + (p.skills.some((q) => mask & (1 << q)) ? p.cap : 0),
    0,
  )
}

/**
 * Hall's condition over all non-empty subsets.
 * Rejects negatives; does not enforce sum === total (caller keeps that invariant).
 */
export function feasible(
  x: readonly number[],
  profiles: SkillProfile[],
  nQ: number,
): boolean {
  if (x.some((v) => v < 0)) return false
  const limit = 1 << nQ
  for (let m = 1; m < limit; m++) {
    let s = 0
    for (let q = 0; q < nQ; q++) {
      if (m & (1 << q)) s += x[q]
    }
    if (s > fS(profiles, m)) return false
  }
  return true
}

/** Static skill-imposed [lo, hi] per queue (amber band). */
export function computeHardRanges(
  profiles: SkillProfile[],
  total: number,
  nQ: number,
): HardRange[] {
  const all = (1 << nQ) - 1
  const hard: HardRange[] = []
  for (let i = 0; i < nQ; i++) {
    const hHi = fS(profiles, 1 << i)
    const hLo = Math.max(0, total - fS(profiles, all & ~(1 << i)))
    hard.push([hLo, hHi])
  }
  return hard
}

/**
 * One-agent swap: move one agent to/from queue `i` by taking from / giving to
 * the largest / smallest unlocked other queue that keeps the state feasible.
 */
export function step(
  st: readonly number[],
  i: number,
  dir: 1 | -1,
  locked: readonly boolean[],
  profiles: SkillProfile[],
  total: number,
): number[] | null {
  const nQ = st.length
  const cand: number[] = []
  for (let k = 0; k < nQ; k++) {
    if (k !== i && !locked[k]) cand.push(k)
  }
  cand.sort((a, b) => (dir > 0 ? st[b] - st[a] : st[a] - st[b]))
  for (const c of cand) {
    const y = st.slice()
    y[i] += dir
    y[c] -= dir
    if (y[c] >= 0 && y[i] >= 0 && y[i] <= total && feasible(y, profiles, nQ)) {
      return y
    }
  }
  return null
}

/** Dynamic [lo, hi] for queue `i` given current allocation and locks (green band). */
export function coordRange(
  x: readonly number[],
  i: number,
  locked: readonly boolean[],
  profiles: SkillProfile[],
  total: number,
): DynRange {
  if (locked[i]) return [x[i], x[i]]
  let y = x.slice()
  let hi = x[i]
  for (;;) {
    const z = step(y, i, 1, locked, profiles, total)
    if (!z) break
    y = z
    hi = y[i]!
  }
  y = x.slice()
  let lo = x[i]
  for (;;) {
    const z = step(y, i, -1, locked, profiles, total)
    if (!z) break
    y = z
    lo = y[i]!
  }
  return [lo, hi]
}

export function computeDynRanges(
  x: readonly number[],
  locked: readonly boolean[],
  profiles: SkillProfile[],
  total: number,
): DynRange[] {
  return x.map((_, i) => coordRange(x, i, locked, profiles, total))
}

/**
 * Walk unit steps until queue `i` reaches `targetInt` (clamped / rounded).
 * Returns a new allocation array; never mutates `x`.
 */
export function moveTo(
  x: readonly number[],
  i: number,
  target: number,
  locked: readonly boolean[],
  profiles: SkillProfile[],
  total: number,
): number[] {
  if (locked[i]) return x.slice()
  const targetInt = Math.max(0, Math.min(total, Math.round(target)))
  let cur = x.slice()
  let guard = 2000
  while (cur[i] < targetInt && guard-- > 0) {
    const z = step(cur, i, 1, locked, profiles, total)
    if (!z) break
    cur = z
  }
  while (cur[i] > targetInt && guard-- > 0) {
    const z = step(cur, i, -1, locked, profiles, total)
    if (!z) break
    cur = z
  }
  return cur
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
