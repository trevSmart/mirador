import { describe, expect, it } from 'vitest'
import {
  chartAbsMax,
  CENTER,
  circleIntersectsRect,
  LABEL_RING_GAP,
  RADAR_VIEW_PAD,
  computeLabelMargins,
  labelAnchorDeg,
  labelAnchorPt,
  labelBlockSvgBounds,
  labelDy,
  labelNameWidth,
  labelTextAnchor,
  magneticSnapAgents,
  magneticSnapThresholdPx,
  MAGNETIC_SNAP_MAX_PX,
  RADIUS,
  fromView,
  toView,
} from './allocator-geometry'

describe('magneticSnapAgents', () => {
  const px = (agents: number) => agents * 10 // 10 CSS px per agent

  it('passes through continuous values far from a step when spacing allows', () => {
    const wide = (a: number) => a * 20 // threshold 8, half-spacing 10
    expect(magneticSnapAgents(6.45, 0, 20, wide, MAGNETIC_SNAP_MAX_PX)).toBe(6.45)
  })

  it('snaps when within max threshold of an integer step', () => {
    expect(magneticSnapAgents(5.4, 0, 20, px, MAGNETIC_SNAP_MAX_PX)).toBe(5)
    expect(magneticSnapAgents(5.45, 0, 20, px, MAGNETIC_SNAP_MAX_PX)).toBe(5)
  })

  it('respects lo/hi bounds when snapping', () => {
    expect(magneticSnapAgents(2.1, 3, 10, px, MAGNETIC_SNAP_MAX_PX)).toBe(3)
    expect(magneticSnapAgents(9.9, 0, 8, px, MAGNETIC_SNAP_MAX_PX)).toBe(8)
  })

  it('shrinks snap radius when steps are dense so zones do not overlap', () => {
    const dense = (a: number) => a * 2 // 2 CSS px per agent → 1px half-spacing
    expect(magneticSnapAgents(5.3, 0, 20, dense, MAGNETIC_SNAP_MAX_PX)).toBe(5)
    expect(magneticSnapAgents(5.55, 0, 20, dense, MAGNETIC_SNAP_MAX_PX)).toBe(6)
    expect(magneticSnapThresholdPx(5, 0, 20, dense, MAGNETIC_SNAP_MAX_PX)).toBe(1)
    expect(magneticSnapThresholdPx(5, 0, 20, px, MAGNETIC_SNAP_MAX_PX)).toBe(5)
    expect(magneticSnapThresholdPx(5, 0, 20, px, MAGNETIC_SNAP_MAX_PX)).toBeLessThanOrEqual(
      MAGNETIC_SNAP_MAX_PX,
    )
  })
})

describe('labelAnchorPt', () => {
  const names = ['Incidència', 'Vendes', 'Atenció', 'Retenció', 'Suport']

  it('keeps label blocks outside the chart disk', () => {
    const chartR = RADIUS + LABEL_RING_GAP
    const nQ = names.length
    for (let k = 0; k < nQ; k++) {
      const deg = labelAnchorDeg(k, nQ)
      const anchor = labelTextAnchor(deg)
      const dy = labelDy(deg)
      const nameW = labelNameWidth(names[k])
      const [tx, ty] = labelAnchorPt(k, nQ, nameW, anchor, dy)
      const bounds = labelBlockSvgBounds(tx, ty, nameW, anchor)

      expect(
        circleIntersectsRect(
          bounds.minX - CENTER,
          bounds.minY - CENTER,
          bounds.maxX - CENTER,
          bounds.maxY - CENTER,
          chartR,
        ),
      ).toBe(false)
    }
  })
})

describe('computeLabelMargins', () => {
  it('includes label overflow beyond the chart disk on every side', () => {
    const names = ['Incidència', 'Vendes', 'Atenció', 'Retenció', 'Suport']
    const m = computeLabelMargins(names)
    expect(m.left).toBeGreaterThan(RADAR_VIEW_PAD)
    expect(m.right).toBeGreaterThan(RADAR_VIEW_PAD)
    expect(m.top).toBeGreaterThan(RADAR_VIEW_PAD)
    expect(m.bottom).toBeGreaterThan(RADAR_VIEW_PAD)
  })
})

describe('chartAbsMax / absolute scale', () => {
  const hard: (readonly [number, number])[] = [
    [0, 8],
    [0, 9],
    [0, 2],
    [0, 6],
    [0, 5],
  ]

  it('maps the highest hard ceiling to the chart outer edge', () => {
    expect(chartAbsMax(hard)).toBe(9)
    expect(toView(1, 9, 'abs', 17, hard)).toBe(100)
    expect(toView(4, 5, 'abs', 17, hard)).toBeCloseTo((5 / 9) * 100)
    expect(fromView(0, 50, 'abs', 17, hard)).toBe(4.5)
  })
})
