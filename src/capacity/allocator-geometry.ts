/** SVG geometry helpers for the capacity radar (areas / lines views). */

export const CENTER = 230
export const RADIUS = 164

export function axisAngle(k: number, nQ: number): number {
  return ((-90 + (k * 360) / nQ) * Math.PI) / 180
}

function halfSlice(nQ: number): number {
  return ((180 / nQ) * Math.PI) / 180
}

/** Shared radial max for absolute scale: outer chart edge = highest per-queue hard ceiling. */
export function chartAbsMax(hard: readonly (readonly [number, number])[]): number {
  if (hard.length === 0) return 1
  return Math.max(1, ...hard.map(([, hi]) => hi))
}

export function toView(
  k: number,
  v: number,
  mode: 'norm' | 'abs',
  _total: number,
  hard: readonly (readonly [number, number])[],
): number {
  if (mode === 'abs') return (v / chartAbsMax(hard)) * 100
  const [lo, hi] = hard[k]
  if (hi <= lo) return 50
  return ((v - lo) / (hi - lo)) * 100
}

export function fromView(
  k: number,
  pos: number,
  mode: 'norm' | 'abs',
  _total: number,
  hard: readonly (readonly [number, number])[],
): number {
  if (mode === 'abs') return (pos / 100) * chartAbsMax(hard)
  const [lo, hi] = hard[k]
  return lo + (pos / 100) * (hi - lo)
}

/** Clearance between the chart outer ring (100%) and the label block edge. */
export const LABEL_RING_GAP = 14

const RADAR_VIEW_PAD = 10

/** Drawn SVG box / chart diameter — the viewBox pad inflates the disk element. */
export const RADAR_DISK_SCALE = (RADIUS + RADAR_VIEW_PAD) / RADIUS

/** Unit direction of queue k's axis (= mid-angle of its slice), y down. */
export function axisUnit(k: number, nQ: number): [number, number] {
  const a = axisAngle(k, nQ)
  return [Math.cos(a), Math.sin(a)]
}

export type LabelTextAnchor = 'middle' | 'start' | 'end'

/** Text alignment inside the block — outward-facing, so it hugs the ring. */
export function labelTextAnchor(ux: number): LabelTextAnchor {
  if (ux > 0.2) return 'start'
  if (ux < -0.2) return 'end'
  return 'middle'
}

/** A measured label block placed along a queue axis. */
export type LabelBox = {
  ux: number
  uy: number
  width: number
  height: number
}

/**
 * Label bounds relative to the chart center, for an anchor at distance `r`.
 * The block is shifted outward by half its own size along the axis, so its
 * trailing edge lands on the anchor point.
 */
export function labelBoxBounds(box: LabelBox, r: number): SvgBounds {
  const cx = box.ux * (r + box.width / 2)
  const cy = box.uy * (r + box.height / 2)
  return {
    minX: cx - box.width / 2,
    minY: cy - box.height / 2,
    maxX: cx + box.width / 2,
    maxY: cy + box.height / 2,
  }
}

/** Chart-center coords: whether a rect overlaps the chart disk. */
export function circleIntersectsRect(
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number,
  radius: number,
): boolean {
  const closestX = Math.max(xmin, Math.min(0, xmax))
  const closestY = Math.max(ymin, Math.min(0, ymax))
  return closestX * closestX + closestY * closestY < radius * radius
}

/**
 * Anchor distance for a label: the ring plus `gap`, nudged out only as far as a
 * corner-overlapping block needs (diagonal axes), and never past `2 × gap` so
 * every label stays at a comparable distance from the ring.
 */
export function labelAnchorRadius(
  box: LabelBox,
  radius: number,
  gap = LABEL_RING_GAP,
): number {
  const clearR = radius + gap
  const maxR = clearR + gap
  let r = clearR
  for (let iter = 0; iter < 24; iter++) {
    const { minX, minY, maxX, maxY } = labelBoxBounds(box, r)
    const closestX = Math.max(minX, Math.min(0, maxX))
    const closestY = Math.max(minY, Math.min(0, maxY))
    const dist = Math.hypot(closestX, closestY)
    if (dist >= clearR - 0.5) break
    r += clearR - dist
    if (r >= maxR) return maxR
  }
  return Math.min(r, maxR)
}

export type SvgBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function mergeSvgBounds(a: SvgBounds, b: SvgBounds): SvgBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

function chartSvgBounds(): SvgBounds {
  return {
    minX: CENTER - RADIUS,
    minY: CENTER - RADIUS,
    maxX: CENTER + RADIUS,
    maxY: CENTER + RADIUS,
  }
}

/** Everything the stage must fit, relative to the chart center, at radius `r`. */
export function radarContentBounds(
  boxes: readonly LabelBox[],
  radius: number,
  gap = LABEL_RING_GAP,
): SvgBounds {
  const disk = radius * RADAR_DISK_SCALE
  let bounds: SvgBounds = { minX: -disk, minY: -disk, maxX: disk, maxY: disk }
  for (const box of boxes) {
    bounds = mergeSvgBounds(bounds, labelBoxBounds(box, labelAnchorRadius(box, radius, gap)))
  }
  return bounds
}

export type RadarLayout = {
  radius: number
  cx: number
  cy: number
}

/** Smallest radius the stage is allowed to shrink the chart to. */
const MIN_CHART_RADIUS = 40

/**
 * Largest chart radius whose disk + labels fit `availW × availH`, plus the chart
 * center that keeps the whole content block centered in the stage.
 */
export function fitRadarLayout(
  availW: number,
  availH: number,
  boxes: readonly LabelBox[],
  gap = LABEL_RING_GAP,
  maxRadius = RADIUS * 1.6,
): RadarLayout {
  const fits = (r: number) => {
    const b = radarContentBounds(boxes, r, gap)
    return b.maxX - b.minX <= availW && b.maxY - b.minY <= availH
  }

  let radius: number
  if (fits(maxRadius)) {
    radius = maxRadius
  } else {
    let lo = MIN_CHART_RADIUS
    let hi = maxRadius
    for (let iter = 0; iter < 24; iter++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    radius = lo
  }

  const b = radarContentBounds(boxes, radius, gap)
  return {
    radius,
    cx: (availW - (b.maxX - b.minX)) / 2 - b.minX,
    cy: (availH - (b.maxY - b.minY)) / 2 - b.minY,
  }
}

export function computeChartViewBox(pad = RADAR_VIEW_PAD): string {
  const b = chartSvgBounds()
  const minX = b.minX - pad
  const minY = b.minY - pad
  const w = b.maxX - b.minX + 2 * pad
  const h = b.maxY - b.minY + 2 * pad
  return `${minX} ${minY} ${w} ${h}`
}

export function axisPt(
  k: number,
  pos: number,
  nQ: number,
): [number, number] {
  const a = axisAngle(k, nQ)
  const r = (Math.max(0, pos) / 100) * RADIUS
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)]
}

export function smoothClosed(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length
  if (n === 0) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return `${d} Z`
}

function pol(mid: number, ang: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(mid + ang), CENTER + r * Math.sin(mid + ang)]
}

export function annulus(k: number, p0: number, p1: number, nQ: number): string {
  const mid = axisAngle(k, nQ)
  const half = halfSlice(nQ)
  const r0 = (Math.max(0, Math.min(100, p0)) / 100) * RADIUS
  const r1 = (Math.max(0, Math.min(100, p1)) / 100) * RADIUS
  if (r1 <= r0 + 0.1) return ''
  const o1a = pol(mid, -half, r1)
  const o1b = pol(mid, half, r1)
  if (r0 < 0.5) {
    return `M ${CENTER} ${CENTER} L ${o1a[0].toFixed(1)} ${o1a[1].toFixed(1)} A ${r1.toFixed(1)} ${r1.toFixed(1)} 0 0 1 ${o1b[0].toFixed(1)} ${o1b[1].toFixed(1)} Z`
  }
  const i0a = pol(mid, -half, r0)
  const i0b = pol(mid, half, r0)
  return `M ${o1a[0].toFixed(1)} ${o1a[1].toFixed(1)} A ${r1.toFixed(1)} ${r1.toFixed(1)} 0 0 1 ${o1b[0].toFixed(1)} ${o1b[1].toFixed(1)} L ${i0b[0].toFixed(1)} ${i0b[1].toFixed(1)} A ${r0.toFixed(1)} ${r0.toFixed(1)} 0 0 0 ${i0a[0].toFixed(1)} ${i0a[1].toFixed(1)} Z`
}

export function arcAt(k: number, pos: number, nQ: number): string {
  const mid = axisAngle(k, nQ)
  const half = halfSlice(nQ)
  const r = (Math.max(0, Math.min(100, pos)) / 100) * RADIUS
  const a = pol(mid, -half, r)
  const b = pol(mid, half, r)
  return `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
}

export function dividerEnds(k: number, nQ: number): [number, number, number, number] {
  const mid = axisAngle(k, nQ) + halfSlice(nQ)
  const x2 = CENTER + (RADIUS + 3) * Math.cos(mid)
  const y2 = CENTER + (RADIUS + 3) * Math.sin(mid)
  return [CENTER, CENTER, x2, y2]
}

function readSvgViewBox(svg: SVGSVGElement): {
  x: number
  y: number
  width: number
  height: number
} {
  const base = svg.viewBox.baseVal
  return { x: base.x, y: base.y, width: base.width, height: base.height }
}

export function clientToSvg(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): [number, number] {
  const rect = svg.getBoundingClientRect()
  const vb = readSvgViewBox(svg)
  return [
    vb.x + ((clientX - rect.left) / rect.width) * vb.width,
    vb.y + ((clientY - rect.top) / rect.height) * vb.height,
  ]
}

/** CSS pixels per SVG user unit (assumes uniform scale from the viewBox). */
export function svgCssScale(svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect()
  const vb = readSvgViewBox(svg)
  return rect.width / vb.width
}

/**
 * Max magnetic snap radius along the track. Capped per-step so adjacent integer
 * snap zones never overlap (see `magneticSnapThresholdPx`).
 */
export const MAGNETIC_SNAP_MAX_PX = 8

/**
 * Safe snap radius at integer `nearest`: at most half the pixel distance to
 * each neighbour step, capped by `maxPx`.
 */
export function magneticSnapThresholdPx(
  nearest: number,
  lo: number,
  hi: number,
  agentsToCssPx: (agents: number) => number,
  maxPx: number,
): number {
  let halfSpacing = Infinity
  if (nearest > lo) {
    halfSpacing = Math.min(
      halfSpacing,
      Math.abs(agentsToCssPx(nearest) - agentsToCssPx(nearest - 1)) / 2,
    )
  }
  if (nearest < hi) {
    halfSpacing = Math.min(
      halfSpacing,
      Math.abs(agentsToCssPx(nearest + 1) - agentsToCssPx(nearest)) / 2,
    )
  }
  return Math.min(maxPx, halfSpacing)
}

/**
 * Soft magnetic snap: continuous motion, but stick to the nearest integer step
 * when within the effective threshold (≤ `maxThresholdPx`, shrunk when steps are dense).
 */
export function magneticSnapAgents(
  raw: number,
  lo: number,
  hi: number,
  agentsToCssPx: (agents: number) => number,
  maxThresholdPx: number,
): number {
  if (hi <= lo) return lo
  const clamped = Math.max(lo, Math.min(hi, raw))
  const nearest = Math.max(lo, Math.min(hi, Math.round(clamped)))
  const threshold = magneticSnapThresholdPx(nearest, lo, hi, agentsToCssPx, maxThresholdPx)
  if (Math.abs(agentsToCssPx(clamped) - agentsToCssPx(nearest)) <= threshold) {
    return nearest
  }
  return clamped
}

/** Radial / axis distance in CSS px for an agent count on the radar. */
export function agentsToRadarCssPx(
  k: number,
  agents: number,
  mode: 'norm' | 'abs',
  total: number,
  hard: readonly (readonly [number, number])[],
  cssPerSvg: number,
): number {
  return (toView(k, agents, mode, total, hard) / 100) * RADIUS * cssPerSvg
}
