/* Space viewer — isometric (2.5D) grid helpers. Pure geometry, no React/DOM.

   Since the 3D render moved to the basis-vector projection in `space-iso-vec.ts`,
   this module now only keeps:
   - the 2D grid rotation helpers used by `SpaceView` (`rotateCell`, `rotateEdge`,
     `roomBounds2D`);
   - the camera-direction-aware back-wall topology (`backLeftTrue` / `backRightTrue`)
     and the opening quad (`openingQuad`), which `space-iso-vec` reuses at dir 0. */

import type { Cell, Edge, Dir } from './types'
export type { Dir }

const TW = 34 // tile half-width (rhombus)
const TH = 17 // tile half-height
const WALL_H = 104 // exterior wall height

export type Point = [number, number]

/** Project a grid cell to the centre of its rhombus, for camera direction `dir`. */
function projectCell(c: number, r: number, dir: Dir, maxC: number, maxR: number): Point {
  if (dir === 1) return [(maxR - r - c) * TW, (maxR + c - r) * TH]
  if (dir === 2) return [(maxR - r - c) * TW, (maxR - r + c) * TH]
  if (dir === 3) return [(r + c - maxC) * TW, (r + maxR - c) * TH]
  return [(c - r) * TW, (c + r) * TH]
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export type OpeningQuad = { bl: Point; br: Point; tr: Point; tl: Point }

/** Window/door opening as corner points on a wall quad. */
export function openingQuad(
  g0: Point,
  g1: Point,
  t0: Point,
  t1: Point,
  kind: 'door' | 'window',
): OpeningQuad {
  const vLo = kind === 'door' ? 0 : 0.32
  const vHi = kind === 'door' ? 0.62 : 0.7
  return {
    bl: lerp(g0, t0, vLo),
    tl: lerp(g0, t0, vHi),
    br: lerp(g1, t1, vLo),
    tr: lerp(g1, t1, vHi),
  }
}

type Has = (c: number, r: number) => boolean

/* Edge-visibility predicates, recomputed per camera direction. Each returns true
   when the corresponding back wall faces an empty neighbour. */

function backRightVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c - 1, r)
  if (dir === 2) return (c, r) => !has(c - 1, r)
  if (dir === 3) return (c, r) => !has(c + 1, r)
  return (c, r) => !has(c, r - 1)
}
function backLeftVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c, r + 1)
  if (dir === 2) return (c, r) => !has(c, r + 1)
  if (dir === 3) return (c, r) => !has(c, r - 1)
  return (c, r) => !has(c - 1, r)
}

/* A back-facing exterior edge is only a *true* back wall when the room does not
   continue behind it. In a concave room (L/step, U/courtyard, donut…) an edge
   can be parallel to the real back wall yet sit at an inner step or face an
   interior void: it has no immediate neighbour, so backRight/LeftVisible accept
   it, but the room carries on behind it. Two independent conditions must hold:

   1. Silhouette: scanning outward from the edge along the direction it faces,
      no room cell re-appears. If it does, the empty neighbour is an interior
      gap (a courtyard or hole), not the exterior backdrop — even when a wall
      there would hide nothing (it can be short enough to clear the far space).
   2. No occlusion: the wall's projected quad covers no farther space tile. This
      catches staircase offsets where a near wing's tall wall would paint over a
      farther wing that sits beside it (not directly behind it in the grid).

   Geometry for (2) is screen-space, so it is dir-agnostic once cells project. */

/** Grid step (dc, dr) a back wall faces, i.e. toward its (empty) neighbour. */
function backRightFacing(dir: Dir): [number, number] {
  if (dir === 1) return [-1, 0]
  if (dir === 2) return [-1, 0]
  if (dir === 3) return [1, 0]
  return [0, -1]
}
function backLeftFacing(dir: Dir): [number, number] {
  if (dir === 1) return [0, 1]
  if (dir === 2) return [0, 1]
  if (dir === 3) return [0, -1]
  return [-1, 0]
}

/** Numeric corners of a back-right wall quad. */
function backRightWallPts(x: number, y: number): Point[] {
  return [[x, y - TH], [x + TW, y], [x + TW, y - WALL_H], [x, y - TH - WALL_H]]
}
/** Numeric corners of a back-left wall quad. */
function backLeftWallPts(x: number, y: number): Point[] {
  return [[x, y - TH], [x - TW, y], [x - TW, y - WALL_H], [x, y - TH - WALL_H]]
}
/** Numeric corners of a tile-top rhombus. */
function diamondPts(x: number, y: number): Point[] {
  return [[x, y - TH], [x + TW, y], [x, y + TH], [x - TW, y]]
}

/** Separating-axis overlap test for two convex polygons. Edge contact (no area
    in common) counts as *not* overlapping, so flush back-row walls survive. */
function convexOverlap(a: Point[], b: Point[]): boolean {
  const EPS = 1e-6
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const axis: Point = [-(q[1] - p[1]), q[0] - p[0]]
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
      for (const [px, py] of a) {
        const d = px * axis[0] + py * axis[1]
        if (d < minA) minA = d
        if (d > maxA) maxA = d
      }
      for (const [px, py] of b) {
        const d = px * axis[0] + py * axis[1]
        if (d < minB) minB = d
        if (d > maxB) maxB = d
      }
      if (maxA <= minB + EPS || maxB <= minA + EPS) return false
    }
  }
  return true
}

/** Silhouette test: scanning outward from (c, r) along (dc, dr), no room cell
    re-appears within the grid — so the edge faces the exterior, not a void. */
function onBackSilhouette(has: Has, c: number, r: number, dc: number, dr: number, maxC: number, maxR: number): boolean {
  let cc = c + dc
  let rr = r + dr
  while (cc >= 0 && cc <= maxC && rr >= 0 && rr <= maxR) {
    if (has(cc, rr)) return false
    cc += dc
    rr += dr
  }
  return true
}

function backWallTrue(
  base: Has,
  facing: [number, number],
  wallPts: (x: number, y: number) => Point[],
  has: Has,
  cells: Cell[],
  dir: Dir,
  maxC: number,
  maxR: number,
): Has {
  const cmp = depthCompare(dir)
  const [fdc, fdr] = facing
  return (c, r) => {
    if (!base(c, r)) return false
    // (1) Must sit on the room's exterior silhouette in its facing direction.
    if (!onBackSilhouette(has, c, r, fdc, fdr, maxC, maxR)) return false
    // (2) Must not occlude a farther space tile.
    const [x, y] = projectCell(c, r, dir, maxC, maxR)
    const wall = wallPts(x, y)
    for (const cell of cells) {
      const [oc, or] = cell
      if (oc === c && or === r) continue
      if (cmp(cell, [c, r]) >= 0) continue // only farther tiles can be hidden
      const [ox, oy] = projectCell(oc, or, dir, maxC, maxR)
      if (convexOverlap(wall, diamondPts(ox, oy))) return false
    }
    return true
  }
}

/** Paints only true back walls: rejects edges that face an interior void
    (silhouette) or whose wall would hide farther space. */
export function backRightTrue(has: Has, cells: Cell[], dir: Dir, maxC: number, maxR: number): Has {
  return backWallTrue(backRightVisible(has, dir), backRightFacing(dir), backRightWallPts, has, cells, dir, maxC, maxR)
}
/** Like `backRightTrue`, for the back-left wall. */
export function backLeftTrue(has: Has, cells: Cell[], dir: Dir, maxC: number, maxR: number): Has {
  return backWallTrue(backLeftVisible(has, dir), backLeftFacing(dir), backLeftWallPts, has, cells, dir, maxC, maxR)
}

/** Comparator that orders cells far → near for the painter's algorithm. */
function depthCompare(dir: Dir): (a: Cell, b: Cell) => number {
  if (dir === 1) return (a, b) => a[0] - a[1] - (b[0] - b[1]) || a[0] - b[0]
  if (dir === 2) return (a, b) => a[0] - a[1] - (b[0] - b[1]) || a[0] - b[0]
  if (dir === 3) return (a, b) => a[1] - a[0] - (b[1] - b[0]) || a[1] - b[1]
  return (a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]
}

/** Rotate a cell 90°·dir clockwise inside an n×n square grid. */
export function rotateCell(c: number, r: number, dir: Dir, n: number): [number, number] {
  if (dir === 1) return [n - 1 - r, c]
  if (dir === 2) return [n - 1 - c, n - 1 - r]
  if (dir === 3) return [r, n - 1 - c]
  return [c, r]
}

/** Rotate a wall edge label 90°·dir clockwise (N→E→S→O). */
export function rotateEdge(edge: Edge, dir: Dir): Edge {
  const order: Edge[] = ['N', 'E', 'S', 'O']
  const i = order.indexOf(edge)
  if (i < 0) return edge
  return order[(i + dir) % 4]
}

/** Bounding box of cells after rotation, as grid extents. */
export function roomBounds2D(
  cells: Cell[],
  dir: Dir,
  n: number,
): { minC: number; minR: number; cols: number; rows: number } {
  if (cells.length === 0) return { minC: 0, minR: 0, cols: 1, rows: 1 }
  let minC = Infinity
  let minR = Infinity
  let maxC = -Infinity
  let maxR = -Infinity
  for (const [c, r] of cells) {
    const [rc, rr] = rotateCell(c, r, dir, n)
    minC = Math.min(minC, rc)
    minR = Math.min(minR, rr)
    maxC = Math.max(maxC, rc)
    maxR = Math.max(maxR, rr)
  }
  return { minC, minR, cols: maxC - minC + 1, rows: maxR - minR + 1 }
}
