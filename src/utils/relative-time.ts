const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/**
 * Format the elapsed time between `fromMs` and `nowMs` as a Catalan relative
 * string: "fa 5 s", "fa 2 min", "fa 1 h". A future `fromMs` clamps to "fa 0 s".
 * Pure: callers pass `nowMs` so the result is deterministic and testable.
 */
export function formatRelativeTime(fromMs: number, nowMs: number): string {
  const elapsed = Math.max(0, nowMs - fromMs)

  if (elapsed < MINUTE) {
    return `fa ${Math.floor(elapsed / SECOND)} s`
  }
  if (elapsed < HOUR) {
    return `fa ${Math.floor(elapsed / MINUTE)} min`
  }
  return `fa ${Math.floor(elapsed / HOUR)} h`
}
