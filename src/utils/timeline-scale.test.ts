import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hourTicks, hourWindow, msToPercent, segmentBox } from './timeline-scale'

const HOUR = 3_600_000
const base = new Date(2026, 6, 9, 0, 0, 0, 0).getTime() // local midnight

describe('msToPercent', () => {
  it('maps a value linearly across the window', () => {
    expect(msToPercent(base, base, base + 4 * HOUR)).toBe(0)
    expect(msToPercent(base + 2 * HOUR, base, base + 4 * HOUR)).toBe(50)
    expect(msToPercent(base + 4 * HOUR, base, base + 4 * HOUR)).toBe(100)
  })

  it('clamps out-of-range values to 0..100', () => {
    expect(msToPercent(base - HOUR, base, base + 4 * HOUR)).toBe(0)
    expect(msToPercent(base + 10 * HOUR, base, base + 4 * HOUR)).toBe(100)
  })

  it('returns 0 for a non-positive span', () => {
    expect(msToPercent(base, base, base)).toBe(0)
  })
})

describe('segmentBox', () => {
  const start = base + 8 * HOUR
  const end = base + 12 * HOUR

  it('computes left/width from ISO timestamps', () => {
    const box = segmentBox(
      new Date(base + 9 * HOUR).toISOString(),
      new Date(base + 10 * HOUR).toISOString(),
      start,
      end,
      end,
    )
    expect(box.left).toBe(25)
    expect(box.width).toBe(25)
  })

  it('resolves an open end (null) to openEndMs', () => {
    const box = segmentBox(
      new Date(base + 9 * HOUR).toISOString(),
      null,
      start,
      end,
      base + 11 * HOUR,
    )
    expect(box.left).toBe(25)
    expect(box.width).toBe(50)
  })
})

describe('hourTicks', () => {
  it('emits one tick per whole hour within the window', () => {
    const ticks = hourTicks(base + 8 * HOUR, base + 11 * HOUR)
    expect(ticks.map((t) => t.label)).toEqual(['8:00', '9:00', '10:00', '11:00'])
  })

  it('returns [] for an empty window', () => {
    expect(hourTicks(base + HOUR, base)).toEqual([])
  })

  it('places every tick on a local whole hour and labels it with that hour', () => {
    // Regression for non-whole-hour UTC offsets (e.g. Asia/Kolkata, +5:30):
    // ticks must sit on local wall-clock hours, not whole epoch (UTC) hours,
    // and the ":00" label must describe the tick's actual local time.
    const ticks = hourTicks(base + 8 * HOUR + 10 * 60_000, base + 11 * HOUR)
    expect(ticks.map((t) => t.label)).toEqual(['9:00', '10:00', '11:00'])
    for (const tick of ticks) {
      const d = new Date(tick.ms)
      expect(d.getMinutes()).toBe(0)
      expect(d.getSeconds()).toBe(0)
      expect(tick.label).toBe(`${d.getHours()}:00`)
    }
  })
})

describe('hourWindow', () => {
  it('rounds bounds out to whole hours', () => {
    const w = hourWindow(base + 8 * HOUR + 20 * 60_000, base + 11 * HOUR + 5 * 60_000)
    expect(w.start).toBe(base + 8 * HOUR)
    expect(w.end).toBe(base + 12 * HOUR)
  })

  it('guarantees a non-empty span', () => {
    const w = hourWindow(base, base)
    expect(w.end).toBe(w.start + HOUR)
  })

  it('rounds to local wall-clock hours regardless of UTC offset', () => {
    // Same regression as the hourTicks local-hour test: in +5:30/+5:45 zones,
    // epoch-hour rounding lands the window bounds on local :30/:45.
    const w = hourWindow(base + 8 * HOUR + 20 * 60_000, base + 11 * HOUR + 5 * 60_000)
    expect(new Date(w.start).getMinutes()).toBe(0)
    expect(new Date(w.end).getMinutes()).toBe(0)
  })
})

// In whole-hour-offset zones (UTC on CI, Europe/Madrid locally) local midnight
// IS a whole epoch hour, so the local-hour tests above would also pass with
// the old epoch-hour rounding. This block pins a +5:30 zone so the regression
// stays guarded on any runner. Node invalidates the Date timezone cache when
// process.env.TZ changes, and the first test asserts that actually happened.
describe('local-hour rounding under a non-whole-hour UTC offset', () => {
  const originalTZ = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata'
  })

  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('the runtime honours the pinned timezone (guard is effective)', () => {
    expect(new Date(2026, 6, 9).getTimezoneOffset()).toBe(-330)
  })

  it('hourTicks stays on local whole hours', () => {
    const kolkataBase = new Date(2026, 6, 9, 0, 0, 0, 0).getTime()
    const ticks = hourTicks(kolkataBase + 8 * HOUR + 10 * 60_000, kolkataBase + 11 * HOUR)
    expect(ticks.map((t) => t.label)).toEqual(['9:00', '10:00', '11:00'])
    for (const tick of ticks) {
      const d = new Date(tick.ms)
      expect(d.getMinutes()).toBe(0)
      expect(tick.label).toBe(`${d.getHours()}:00`)
    }
  })

  it('hourWindow bounds stay on local whole hours', () => {
    const kolkataBase = new Date(2026, 6, 9, 0, 0, 0, 0).getTime()
    const w = hourWindow(kolkataBase + 8 * HOUR + 20 * 60_000, kolkataBase + 11 * HOUR + 5 * 60_000)
    expect(w.start).toBe(kolkataBase + 8 * HOUR)
    expect(w.end).toBe(kolkataBase + 12 * HOUR)
    expect(new Date(w.start).getMinutes()).toBe(0)
    expect(new Date(w.end).getMinutes()).toBe(0)
  })
})
