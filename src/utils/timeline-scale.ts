/* Pure time-axis helpers for the agent timeline (Gantt). No dates library and
   no `Date.now()` inside — callers pass epoch ms so results are deterministic
   and testable, like relative-time.ts. */

const HOUR = 3_600_000

export interface HourTick {
  ms: number
  /** "9:00", "14:00" — local hour of the tick. */
  label: string
}

/** Position of `ms` within [startMs, endMs] as a 0–100 percentage, clamped. */
export function msToPercent(ms: number, startMs: number, endMs: number): number {
  const span = endMs - startMs
  if (span <= 0) return 0
  const pct = ((ms - startMs) / span) * 100
  return Math.max(0, Math.min(100, pct))
}

/** Left/width box (in %) for a segment, resolving an open end (null) to
    `openEndMs` (usually "now" or the window end). Width is clamped ≥ 0. */
export function segmentBox(
  start: string,
  end: string | null,
  windowStart: number,
  windowEnd: number,
  openEndMs: number,
): { left: number; width: number } {
  const startMs = Date.parse(start)
  const endMs = end === null ? openEndMs : Date.parse(end)
  const left = msToPercent(startMs, windowStart, windowEnd)
  const right = msToPercent(endMs, windowStart, windowEnd)
  return { left, width: Math.max(0, right - left) }
}

/** Hour ticks strictly inside (or on the left edge of) the window. Starts at the
    first whole hour ≥ windowStart, then every hour up to windowEnd. */
export function hourTicks(windowStart: number, windowEnd: number): HourTick[] {
  if (windowEnd <= windowStart) return []
  const ticks: HourTick[] = []
  const first = Math.ceil(windowStart / HOUR) * HOUR
  for (let ms = first; ms <= windowEnd; ms += HOUR) {
    ticks.push({ ms, label: `${new Date(ms).getHours()}:00` })
  }
  return ticks
}

/** Rounds [minMs, maxMs] out to whole-hour bounds, with a small pad, so the
    axis breathes and starts/ends on clean hour marks. */
export function hourWindow(
  minMs: number,
  maxMs: number,
): { start: number; end: number } {
  const start = Math.floor(minMs / HOUR) * HOUR
  const end = Math.ceil(maxMs / HOUR) * HOUR
  // Guarantee a non-empty span even if everything is within one hour.
  return { start, end: end > start ? end : start + HOUR }
}
