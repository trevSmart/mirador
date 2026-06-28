/* Vectorial reformulation of the isometric projection used by the Space view.
   It expresses the space geometry in terms of two independent basis vectors
   `u` (one step in column c) and `v` (one step in row r) instead of the fixed
   `±TW / ±TH` offsets the legacy `space-iso.ts` hardcodes.

   With `u` and `v` free to be *non-mirror* vectors the azimuth can tilt away
   from the symmetric 45°, which powers the per-room drag-to-orbit camera. */

import { backLeftTrue, backRightTrue, openingQuad, rotateCell } from './space-iso'
import type { Cell, Dir, Edge, Space, Opening } from './types'

export type Point = [number, number]

// Tile metrics that reproduce the official look at azimuth 45° / tilt 0.5.
export const VEC_TW = 34
export const VEC_TH = 17
const VEC_THK = 5
const VEC_WALL_H = 120
const VEC_DIV_H = 14
export const VEC_SEAT_MIN_H = 4
export const VEC_SEAT_MAX_H = 88

const GRID_N = 50

/** Screen basis: `u` = delta per +1 column, `v` = delta per +1 row, plus the
    vertical heights (which always rise straight up the screen). */
export interface IsoBasis {
  ux: number
  uy: number
  vx: number
  vy: number
  wallH: number
  thk: number
}

/**
 * Build a basis from an azimuth angle and a vertical foreshortening (tilt).
 * Models camera orbit around the room centre:
 *  - azimuthDeg (yaw)   → horizontal orbit; 45° = classic 2:1 isometric.
 *  - tilt (pitch)       → vertical foreshortening / viewing elevation.
 *  - azimuthDeg ≠ 45    → dimetric: `u` and `v` stop being mirrors on screen.
 */
export function makeBasis(azimuthDeg: number, tilt = 0.5): IsoBasis {
  // Scale chosen so the classic 45° case reproduces TW/TH exactly.
  const S = VEC_TW / Math.cos(Math.PI / 4)
  const a = (azimuthDeg * Math.PI) / 180
  return {
    ux: S * Math.cos(a),
    uy: S * tilt * Math.sin(a),
    vx: -S * Math.sin(a),
    vy: S * tilt * Math.cos(a),
    wallH: VEC_WALL_H,
    thk: VEC_THK,
  }
}

/** Cell centre in screen space (dir-0 space — see `normalizeSpace`). */
export function projectCellVec(c: number, r: number, b: IsoBasis): Point {
  return [c * b.ux + r * b.vx, c * b.uy + r * b.vy]
}

interface TileCorners {
  top: Point
  right: Point
  bottom: Point
  left: Point
}

/** The four corners of a cell's parallelogram (the generalised rhombus). */
function tileCorners(x: number, y: number, b: IsoBasis): TileCorners {
  const hux = b.ux / 2
  const huy = b.uy / 2
  const hvx = b.vx / 2
  const hvy = b.vy / 2
  return {
    top: [x - hux - hvx, y - huy - hvy],
    right: [x + hux - hvx, y + huy - hvy],
    bottom: [x + hux + hvx, y + huy + hvy],
    left: [x - hux + hvx, y - huy + hvy],
  }
}

function str(...pts: Point[]): string {
  return pts.map(([px, py]) => `${px},${py}`).join(' ')
}

/** Lift a point straight up the screen by `h`. */
function up([px, py]: Point, h: number): Point {
  return [px, py - h]
}

/** Tile-top parallelogram, optionally raised by `h`. */
export function diamondPointsVec(x: number, y: number, b: IsoBasis, h = 0): string {
  const { top, right, bottom, left } = tileCorners(x, y, b)
  return str(up(top, h), up(right, h), up(bottom, h), up(left, h))
}

/** A vertical face quad rising from base edge (p0→p1) between heights h1..h2. */
function faceQuad(p0: Point, p1: Point, h1: number, h2: number): string {
  return str(up(p0, h1), up(p1, h1), up(p1, h2), up(p0, h2))
}

// The two visible front faces of a tower share the bottom corner. The "+u" face
// spans bottom→right, the "+v" face spans left→bottom.
export function towerRightFace(x: number, y: number, b: IsoBasis, h1: number, h2: number): string {
  const { right, bottom } = tileCorners(x, y, b)
  return faceQuad(bottom, right, h1, h2)
}
export function towerLeftFace(x: number, y: number, b: IsoBasis, h1: number, h2: number): string {
  const { bottom, left } = tileCorners(x, y, b)
  return faceQuad(left, bottom, h1, h2)
}

// Space-slab side faces (front edges) drop DOWN by the slab thickness.
export function slabRightFaceVec(x: number, y: number, b: IsoBasis): string {
  const { right, bottom } = tileCorners(x, y, b)
  return str(right, bottom, up(bottom, -b.thk), up(right, -b.thk))
}
export function slabLeftFaceVec(x: number, y: number, b: IsoBasis): string {
  const { left, bottom } = tileCorners(x, y, b)
  return str(left, bottom, up(bottom, -b.thk), up(left, -b.thk))
}

// Back walls rise from the two far edges (top→right and top→left).
export function backRightWallVec(x: number, y: number, b: IsoBasis): string {
  const { top, right } = tileCorners(x, y, b)
  return faceQuad(top, right, 0, b.wallH)
}
export function backLeftWallVec(x: number, y: number, b: IsoBasis): string {
  const { top, left } = tileCorners(x, y, b)
  return faceQuad(top, left, 0, b.wallH)
}

/** Ground + top corner pair for an opening on a back wall edge, for `openingQuad`. */
export function backRightOpeningEdge(x: number, y: number, b: IsoBasis): [Point, Point, Point, Point] {
  const { top, right } = tileCorners(x, y, b)
  return [top, right, up(top, b.wallH), up(right, b.wallH)]
}
export function backLeftOpeningEdge(x: number, y: number, b: IsoBasis): [Point, Point, Point, Point] {
  const { top, left } = tileCorners(x, y, b)
  return [top, left, up(top, b.wallH), up(left, b.wallH)]
}

/** Footprint of light cast onto the space by a window on a back wall.
   The beam starts at the window's ground sill (a centred slice of the wall's
   ground edge) and is projected across the space along a shared sun direction
   `(sx, sy)` (screen-space, in cell units) by `length` cells. A common sun
   direction for every window makes all the beams parallel, like one light
   source — far more convincing than each beam shooting straight off its wall.
   Returns the quad [near0, near1, far1, far0] plus the near/far edge midpoints
   so the caller can run a gradient that fades along the throw. */
export function windowBeamQuad(
  x: number,
  y: number,
  b: IsoBasis,
  edge: 'N' | 'O',
  sx: number,
  sy: number,
  length: number,
  sill = 0.62,
  spread = 0,
): { points: string; near: [Point, Point]; far: [Point, Point] } {
  const { top, right, left } = tileCorners(x, y, b)
  const [e0, e1] = edge === 'N' ? [top, right] : [top, left]
  // The window only spans the middle `sill` fraction of the wall, so inset the
  // ground edge symmetrically to that width.
  const pad = (1 - sill) / 2
  const n0: Point = [e0[0] + (e1[0] - e0[0]) * pad, e0[1] + (e1[1] - e0[1]) * pad]
  const n1: Point = [e0[0] + (e1[0] - e0[0]) * (1 - pad), e0[1] + (e1[1] - e0[1]) * (1 - pad)]
  // Throw both ends along the shared sun vector (scaled to one cell ≈ |u|).
  const tx = sx * b.ux + sy * b.vx
  const ty = sx * b.uy + sy * b.vy
  // Splay the far ends sideways (along the sill direction n0→n1) so the beam
  // fans out as it travels — `spread` is the extra half-width gained at the
  // throw's end, as a fraction of the sill width.
  const wx = (n1[0] - n0[0]) * spread
  const wy = (n1[1] - n0[1]) * spread
  const far0: Point = [n0[0] + tx * length - wx, n0[1] + ty * length - wy]
  const far1: Point = [n1[0] + tx * length + wx, n1[1] + ty * length + wy]
  return { points: str(n0, n1, far1, far0), near: [n0, n1], far: [far0, far1] }
}

/** Interior divider wall on the shared edge toward the E or S neighbour. */
export function dividerFaceVec(x: number, y: number, b: IsoBasis, edge: 'E' | 'S'): string {
  const { right, bottom, left } = tileCorners(x, y, b)
  return edge === 'E' ? faceQuad(right, bottom, 0, VEC_DIV_H) : faceQuad(left, bottom, 0, VEC_DIV_H)
}

/** Painter's order: far → near. Nearer cells sit lower on screen (larger y). */
export function depthCompareVec(b: IsoBasis): (a: Cell, c: Cell) => number {
  return (a, c) => {
    const ya = a[0] * b.uy + a[1] * b.vy
    const yc = c[0] * b.uy + c[1] * b.vy
    if (ya !== yc) return ya - yc
    return a[0] * b.ux + a[1] * b.vx - (c[0] * b.ux + c[1] * b.vx)
  }
}

export interface IsoBounds {
  minX: number
  minY: number
  width: number
  height: number
}

export function computeBoundsVec(cells: Cell[], b: IsoBasis, topExtra = 0, pad = 22): IsoBounds {
  if (cells.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const topRise = Math.max(b.wallH, VEC_SEAT_MAX_H + topExtra)
  for (const [c, r] of cells) {
    const [x, y] = projectCellVec(c, r, b)
    const cs = tileCorners(x, y, b)
    for (const [px, py] of [cs.top, cs.right, cs.bottom, cs.left]) {
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py - topRise)
      maxY = Math.max(maxY, py + b.thk)
    }
  }
  return { minX: minX - pad, minY: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
}

// ---------------------------------------------------------------------------
// Space normalisation: collapse the space's saved camera `dir` into dir-0 cell
// coordinates, so the vectorial projection only ever needs to handle dir 0.
// ---------------------------------------------------------------------------

export interface NormalizedSpace {
  cells: Cell[]
  seats: { c: number; r: number; agentId: string | null }[]
  openings: Opening[]
  dividers: { c: number; r: number; edge: 'E' | 'S' }[]
}

function canonicalDivider(a: Cell, b: Cell): { c: number; r: number; edge: 'E' | 'S' } | null {
  const dc = b[0] - a[0]
  const dr = b[1] - a[1]
  if (dc === 1 && dr === 0) return { c: a[0], r: a[1], edge: 'E' }
  if (dc === -1 && dr === 0) return { c: b[0], r: b[1], edge: 'E' }
  if (dc === 0 && dr === 1) return { c: a[0], r: a[1], edge: 'S' }
  if (dc === 0 && dr === -1) return { c: b[0], r: b[1], edge: 'S' }
  return null
}

// `rotateEdge` from space-iso rotates N→E→S→O; we need the same to place openings.
const EDGE_ORDER: Edge[] = ['N', 'E', 'S', 'O']
function rotateEdgeLocal(edge: Edge, dir: Dir): Edge {
  const i = EDGE_ORDER.indexOf(edge)
  return i < 0 ? edge : EDGE_ORDER[(i + dir) % 4]
}

/** Rebuild every space element in dir-0 space for `makeBasis`-driven rendering. */
export function normalizeSpace(space: Space): NormalizedSpace {
  const dir = space.dir
  const rc = (c: number, r: number): Cell => rotateCell(c, r, dir, GRID_N)

  const cells = space.cells.map(([c, r]) => rc(c, r))
  const seats = space.seats.map((s) => {
    const [c, r] = rc(s.c, s.r)
    return { c, r, agentId: s.agentId }
  })
  const openings: Opening[] = space.openings.map((o) => {
    const [c, r] = rc(o.c, o.r)
    return { c, r, edge: rotateEdgeLocal(o.edge, dir), kind: o.kind }
  })
  const dividers: { c: number; r: number; edge: 'E' | 'S' }[] = []
  for (const d of space.dividers) {
    const a = rc(d.c, d.r)
    const b = rc(d.edge === 'E' ? d.c + 1 : d.c, d.edge === 'E' ? d.r : d.r + 1)
    const canon = canonicalDivider(a, b)
    if (canon) dividers.push(canon)
  }
  return { cells, seats, openings, dividers }
}

// Re-export the read-only topology helpers so the view imports everything from
// one experimental module (these compute *which* back walls are real).
export { backLeftTrue, backRightTrue, openingQuad }
