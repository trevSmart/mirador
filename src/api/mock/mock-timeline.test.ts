import { describe, expect, it } from 'vitest'
import { MOCK_AGENT } from './mock-ids'
import { buildAgentTimeline } from './mock-timeline'

const DAY = '2026-07-09'
const NOW = new Date(2026, 6, 9, 13, 0, 0, 0).getTime() // 13:00 local, same day
const DAY_START = new Date(2026, 6, 9, 0, 0, 0, 0).getTime()

describe('buildAgentTimeline', () => {
  it('is deterministic for the same (agent, day, now)', () => {
    const a = buildAgentTimeline(MOCK_AGENT.a0, DAY, NOW)
    const b = buildAgentTimeline(MOCK_AGENT.a0, DAY, NOW)
    expect(a).toEqual(b)
  })

  it('returns an empty timeline for an offline agent', () => {
    const t = buildAgentTimeline(MOCK_AGENT.a23, DAY, NOW)
    expect(t.presence).toEqual([])
    expect(t.work).toEqual([])
  })

  it('returns an empty timeline for an unknown agent id', () => {
    const t = buildAgentTimeline('005doesnotexist00', DAY, NOW)
    expect(t.presence).toEqual([])
    expect(t.work).toEqual([])
  })

  it('produces contiguous presence bands within the day window', () => {
    const { presence } = buildAgentTimeline(MOCK_AGENT.a0, DAY, NOW)
    expect(presence.length).toBeGreaterThan(0)

    // Each band starts exactly where the previous ended (no gaps/overlaps).
    for (let i = 0; i < presence.length - 1; i += 1) {
      expect(Date.parse(presence[i].end as string)).toBe(Date.parse(presence[i + 1].start))
    }
    // On today, the last band is still ongoing.
    expect(presence[presence.length - 1].end).toBeNull()

    // First band starts after midnight; nothing extends past "now".
    expect(Date.parse(presence[0].start)).toBeGreaterThanOrEqual(DAY_START)
    for (const band of presence) {
      const end = band.end === null ? NOW : Date.parse(band.end)
      expect(end).toBeLessThanOrEqual(NOW)
    }
  })

  it('derives work bars for an agent with active work', () => {
    const { work } = buildAgentTimeline(MOCK_AGENT.a0, DAY, NOW)
    // a0 seeds 3 active work items; each yields at least its ongoing bar.
    expect(work.length).toBeGreaterThanOrEqual(3)
    expect(work.some((w) => w.end === null)).toBe(true)
    expect(work.every((w) => Date.parse(w.start) >= DAY_START)).toBe(true)
  })

  it('closes all segments on a past day (no ongoing ends)', () => {
    const t = buildAgentTimeline(MOCK_AGENT.a0, '2026-07-08', NOW)
    expect(t.presence.every((p) => p.end !== null)).toBe(true)
    expect(t.work.every((w) => w.end !== null)).toBe(true)
  })
})
