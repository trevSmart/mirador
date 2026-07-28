import { describe, expect, it } from 'vitest'
import {
  axisUnit,
  chartAbsMax,
  circleIntersectsRect,
  fitRadarLayout,
  LABEL_RING_GAP,
  labelAnchorRadius,
  labelBoxBounds,
  labelTextAnchor,
  magneticSnapAgents,
  magneticSnapThresholdPx,
  MAGNETIC_SNAP_MAX_PX,
  radarContentBounds,
  RADIUS,
  fromView,
  toView,
} from './allocator-geometry'

/** Five queues with plausible measured label-block sizes. */
function sampleBoxes(nQ = 5) {
  return Array.from({ length: nQ }, (_, k) => {
    const [ux, uy] = axisUnit(k, nQ)
    return { ux, uy, width: 110 + k * 8, height: 56 }
  })
}

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

describe('labelTextAnchor', () => {
  it('faces the text outward from the chart center', () => {
    expect(labelTextAnchor(axisUnit(0, 5)[0])).toBe('middle') // straight up
    expect(labelTextAnchor(axisUnit(1, 5)[0])).toBe('start') // right side
    expect(labelTextAnchor(axisUnit(4, 5)[0])).toBe('end') // left side
  })
})

describe('labelAnchorRadius', () => {
  it('keeps every label at a comparable distance from the ring', () => {
    const radii = sampleBoxes().map((b) => labelAnchorRadius(b, RADIUS))
    for (const r of radii) {
      expect(r).toBeGreaterThanOrEqual(RADIUS + LABEL_RING_GAP)
      expect(r).toBeLessThanOrEqual(RADIUS + 2 * LABEL_RING_GAP)
    }
  })

  it('does not let a label block cut into the chart disk', () => {
    for (const box of sampleBoxes()) {
      const b = labelBoxBounds(box, labelAnchorRadius(box, RADIUS))
      expect(circleIntersectsRect(b.minX, b.minY, b.maxX, b.maxY, RADIUS)).toBe(false)
    }
  })
})

describe('fitRadarLayout', () => {
  it('centers the disk + label content inside the stage', () => {
    const boxes = sampleBoxes()
    const { radius, cx, cy } = fitRadarLayout(700, 560, boxes)
    const b = radarContentBounds(boxes, radius)

    expect(cx + b.minX).toBeCloseTo(700 - (cx + b.maxX), 5)
    expect(cy + b.minY).toBeCloseTo(560 - (cy + b.maxY), 5)
  })

  it('shrinks the chart until disk + labels fit the stage', () => {
    const boxes = sampleBoxes()
    const tight = fitRadarLayout(420, 380, boxes)
    const roomy = fitRadarLayout(900, 900, boxes)

    expect(tight.radius).toBeLessThan(roomy.radius)
    const b = radarContentBounds(boxes, tight.radius)
    expect(b.maxX - b.minX).toBeLessThanOrEqual(420 + 1e-6)
    expect(b.maxY - b.minY).toBeLessThanOrEqual(380 + 1e-6)
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
