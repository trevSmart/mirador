/** SVG geometry helpers for the capacity radar (areas / lines views). */

export const SVG_SIZE = 460
export const CENTER = 230
export const RADIUS = 164

export function axisAngle(k: number, nQ: number): number {
  return ((-90 + (k * 360) / nQ) * Math.PI) / 180
}

export function halfSlice(nQ: number): number {
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

/** Clearance between the chart outer ring (100%) and label blocks. */
export const LABEL_RING_GAP = 10

export const RADAR_VIEW_PAD = 10

export type LabelTextAnchor = 'middle' | 'start' | 'end'

export function labelAnchorDeg(k: number, nQ: number): number {
  return (((-90 + (k * 360) / nQ) % 360) + 360) % 360
}

export function labelTextAnchor(deg: number): LabelTextAnchor {
  if (deg > 20 && deg < 160) return 'start'
  if (deg > 200 && deg < 340) return 'end'
  return 'middle'
}

export function labelDy(deg: number): number {
  if (deg < 25 || deg > 335) return -6
  if (deg > 155 && deg < 205) return 5
  return 0
}

/** Gap from name trailing edge to lock icon center. */
export const LABEL_LOCK_GAP = 14

/** Lock hit-target / glyph radius. */
export const LABEL_LOCK_R = 9

/** Matches the heuristic in `buildLabels` for lock placement. */
export function labelNameWidth(label: string): number {
  return label.length * 8.5
}

/** X offset from anchor tx to the name's trailing (right) edge in LTR. */
export function labelNameTrailingOffset(nameW: number, anchor: LabelTextAnchor): number {
  return anchor === 'end' ? 0 : anchor === 'start' ? nameW : nameW / 2
}

/** Lock icon center — always just after the queue name. */
export function labelLockCenterX(
  tx: number,
  nameW: number,
  anchor: LabelTextAnchor,
): number {
  return tx + labelNameTrailingOffset(nameW, anchor) + LABEL_LOCK_GAP
}

/** HTML label block extent below the name baseline. */
const LABEL_BLOCK_ABOVE = 12
const LABEL_BLOCK_BELOW = 38
/** Lock chip in HTML row: 22px control + 6px gap. */
const LABEL_LOCK_HTML = 28

function labelCornerOffsets(
  nameW: number,
  anchor: LabelTextAnchor,
): readonly (readonly [number, number])[] {
  const dl = anchor === 'end' ? -nameW : anchor === 'start' ? 0 : -nameW / 2
  const dr = labelNameTrailingOffset(nameW, anchor) + LABEL_LOCK_HTML
  return [
    [dl, -LABEL_BLOCK_ABOVE],
    [dr, -LABEL_BLOCK_ABOVE],
    [dl, LABEL_BLOCK_BELOW],
    [dr, LABEL_BLOCK_BELOW],
  ]
}

function labelBBoxAtR(
  r: number,
  cos: number,
  sin: number,
  dy: number,
  corners: readonly (readonly [number, number])[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [dx, dt] of corners) {
    const x = r * cos + dx
    const y = r * sin + dy + dt
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
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

/** Minimum radial distance so the label block does not overlap the chart disk. */
function labelMinRadius(
  nameW: number,
  anchor: LabelTextAnchor,
  cos: number,
  sin: number,
  dy: number,
): number {
  const chartR = RADIUS + LABEL_RING_GAP
  const corners = labelCornerOffsets(nameW, anchor)
  let r = chartR
  for (let iter = 0; iter < 48; iter++) {
    const { minX, minY, maxX, maxY } = labelBBoxAtR(r, cos, sin, dy, corners)
    const closestX = Math.max(minX, Math.min(0, maxX))
    const closestY = Math.max(minY, Math.min(0, maxY))
    const dist = Math.hypot(closestX, closestY)
    if (dist >= chartR) return r
    r += chartR - dist + 1
  }
  return r
}

/** Anchor point for a queue label — always outside the 100% chart ring. */
export function labelAnchorPt(
  k: number,
  nQ: number,
  nameW: number,
  anchor: LabelTextAnchor,
  dy = 0,
): [number, number] {
  const a = axisAngle(k, nQ)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const r = labelMinRadius(nameW, anchor, cos, sin, dy)
  return [CENTER + r * cos, CENTER + r * sin + dy]
}

export type SvgBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function emptySvgBounds(): SvgBounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

export function mergeSvgBounds(a: SvgBounds, b: SvgBounds): SvgBounds {
  if (a.minX === Infinity) return b
  if (b.minX === Infinity) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

export function expandSvgBounds(bounds: SvgBounds, x: number, y: number, pad = 0): SvgBounds {
  return {
    minX: Math.min(bounds.minX, x - pad),
    minY: Math.min(bounds.minY, y - pad),
    maxX: Math.max(bounds.maxX, x + pad),
    maxY: Math.max(bounds.maxY, y + pad),
  }
}

export function chartSvgBounds(): SvgBounds {
  return {
    minX: CENTER - RADIUS,
    minY: CENTER - RADIUS,
    maxX: CENTER + RADIUS,
    maxY: CENTER + RADIUS,
  }
}

export function labelBlockSvgBounds(
  tx: number,
  ty: number,
  nameW: number,
  anchor: LabelTextAnchor,
): SvgBounds {
  const dl = anchor === 'end' ? -nameW : anchor === 'start' ? 0 : -nameW / 2
  const dr = labelNameTrailingOffset(nameW, anchor) + LABEL_LOCK_HTML
  return {
    minX: tx + dl,
    minY: ty - LABEL_BLOCK_ABOVE,
    maxX: tx + dr,
    maxY: ty + LABEL_BLOCK_BELOW,
  }
}

export function computeLabelMargins(
  names: readonly string[],
  extraPad = RADAR_VIEW_PAD,
): { left: number; right: number; top: number; bottom: number } {
  const nQ = names.length
  if (nQ === 0) {
    return { left: extraPad, right: extraPad, top: extraPad, bottom: extraPad }
  }

  const chartLeft = CENTER - RADIUS
  const chartRight = CENTER + RADIUS
  const chartTop = CENTER - RADIUS
  const chartBottom = CENTER + RADIUS
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0

  for (let k = 0; k < nQ; k++) {
    const nameW = labelNameWidth(names[k])
    const deg = labelAnchorDeg(k, nQ)
    const anchor = labelTextAnchor(deg)
    const dy = labelDy(deg)
    const [tx, ty] = labelAnchorPt(k, nQ, nameW, anchor, dy)
    const b = labelBlockSvgBounds(tx, ty, nameW, anchor)
    left = Math.max(left, chartLeft - b.minX)
    right = Math.max(right, b.maxX - chartRight)
    top = Math.max(top, chartTop - b.minY)
    bottom = Math.max(bottom, b.maxY - chartBottom)
  }

  return {
    left: left + extraPad,
    right: right + extraPad,
    top: top + extraPad,
    bottom: bottom + extraPad,
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

export function computeRadarViewBox(content: SvgBounds, pad = RADAR_VIEW_PAD): string {
  const merged = mergeSvgBounds(chartSvgBounds(), content)
  const minX = merged.minX - pad
  const minY = merged.minY - pad
  const w = merged.maxX - merged.minX + 2 * pad
  const h = merged.maxY - merged.minY + 2 * pad
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

export function readSvgViewBox(svg: SVGSVGElement): {
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
