import { describe, expect, it } from 'vitest'
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
})
