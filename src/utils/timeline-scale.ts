/* Pure time-axis helpers for the agent timeline (Gantt). No dates library and
   no `Date.now()` inside — callers pass epoch ms so results are deterministic
   and testable, like relative-time.ts. */

const HOUR = 3_600_000

export interface HourTick {
  ms: number
  /** "9:00", "14:00" — local hour of the tick. */
  label: string
}

/** Position of `ms` within [startMs, endMs] as a 0–100 percentage, clamped.
    Any NaN input (e.g. a malformed timestamp through Date.parse) yields 0 so we
    never emit `left: 'NaN%'` into inline styles. */
export function msToPercent(ms: number, startMs: number, endMs: number): number {
  const span = endMs - startMs
  if (span <= 0 || Number.isNaN(ms) || Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0
  }
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

/** Latest LOCAL whole hour ≤ ms. Epoch-modulo rounding would give UTC hours,
    which drift from the wall clock in zones with non-whole-hour offsets
    (India +5:30, Nepal +5:45) — hence Date arithmetic instead. */
function floorToLocalHour(ms: number): number {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

/** Earliest LOCAL whole hour ≥ ms. */
function ceilToLocalHour(ms: number): number {
  const floored = floorToLocalHour(ms)
  return floored === ms ? ms : floored + HOUR
}

/** Hour ticks strictly inside (or on the left edge of) the window. Starts at the
    first local whole hour ≥ windowStart, then every hour up to windowEnd. */
export function hourTicks(windowStart: number, windowEnd: number): HourTick[] {
  if (windowEnd <= windowStart) return []
  const ticks: HourTick[] = []
  const first = ceilToLocalHour(windowStart)
  for (let ms = first; ms <= windowEnd; ms += HOUR) {
    ticks.push({ ms, label: `${new Date(ms).getHours()}:00` })
  }
  return ticks
}

/** Rounds [minMs, maxMs] out to local whole-hour bounds so the axis starts/ends
    on clean local hour marks. */
export function hourWindow(
  minMs: number,
  maxMs: number,
): { start: number; end: number } {
  const start = floorToLocalHour(minMs)
  const end = ceilToLocalHour(maxMs)
  // Guarantee a non-empty span even if everything is within one hour.
  return { start, end: end > start ? end : start + HOUR }
}
