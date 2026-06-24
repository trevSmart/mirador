/* Floor viewer — isometric (2.5D) projection helpers.
   Pure geometry, no React/DOM. Reimplements the panorama PoC's projection: a
   grid cell maps to a rhombus, with depth ordering and edge visibility derived
   from the camera direction (0..3, each a 90° turn). */

import type { Cell, Edge, Dir } from './types'
export type { Dir }

export const TW = 34 // tile half-width (rhombus)
export const TH = 17 // tile half-height
export const THK = 6 // floor slab thickness
export const WALL_H = 104 // exterior wall height
export const DIV_H = 14 // interior divider height
export const SEAT_MIN_H = 4
export const SEAT_MAX_H = 88
export const SHADOW_PAD = 1.31

export type Point = [number, number]

/** Project a grid cell to the centre of its rhombus, for camera direction `dir`. */
export function projectCell(c: number, r: number, dir: Dir, maxC: number, maxR: number): Point {
  if (dir === 1) return [(maxR - r - c) * TW, (maxR + c - r) * TH]
  if (dir === 2) return [(maxR - r - c) * TW, (maxR - r + c) * TH]
  if (dir === 3) return [(r + c - maxC) * TW, (r + maxR - c) * TH]
  return [(c - r) * TW, (c + r) * TH]
}

/** Points string for a rhombus centred at (x, y - h). */
export function diamondPoints(x: number, y: number, h = 0): string {
  return `${x},${y - h - TH} ${x + TW},${y - h} ${x},${y - h + TH} ${x - TW},${y - h}`
}

/** A vertical face quad (right/left side of a slab/tower) between heights h1..h2. */
export function rightFace(x: number, y: number, h1: number, h2: number): string {
  return `${x},${y + TH - h1} ${x + TW},${y - h1} ${x + TW},${y - h2} ${x},${y + TH - h2}`
}
export function leftFace(x: number, y: number, h1: number, h2: number): string {
  return `${x - TW},${y - h1} ${x},${y + TH - h1} ${x},${y + TH - h2} ${x - TW},${y - h2}`
}

/** Downward slab side faces (floor thickness), from the tile edge down by THK. */
export function slabRightFace(x: number, y: number): string {
  return `${x + TW},${y} ${x},${y + TH} ${x},${y + TH + THK} ${x + TW},${y + THK}`
}
export function slabLeftFace(x: number, y: number): string {
  return `${x - TW},${y} ${x},${y + TH} ${x},${y + TH + THK} ${x - TW},${y + THK}`
}

/** Back wall quads rising WALL_H from the far edges of a tile. */
export function backRightWall(x: number, y: number): string {
  return `${x},${y - TH} ${x + TW},${y} ${x + TW},${y - WALL_H} ${x},${y - TH - WALL_H}`
}
export function backLeftWall(x: number, y: number): string {
  return `${x},${y - TH} ${x - TW},${y} ${x - TW},${y - WALL_H} ${x},${y - TH - WALL_H}`
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Opening (door/window) frame as a quad on a wall, given its ground+top edges. */
export function openingPoints(
  g0: Point,
  g1: Point,
  t0: Point,
  t1: Point,
  kind: 'door' | 'window',
): string {
  const vLo = kind === 'door' ? 0 : 0.32
  const vHi = kind === 'door' ? 0.62 : 0.7
  const bl = lerp(g0, t0, vLo)
  const tl = lerp(g0, t0, vHi)
  const br = lerp(g1, t1, vLo)
  const tr = lerp(g1, t1, vHi)
  return `${bl[0]},${bl[1]} ${br[0]},${br[1]} ${tr[0]},${tr[1]} ${tl[0]},${tl[1]}`
}

type Has = (c: number, r: number) => boolean

/* Edge-visibility predicates, recomputed per camera direction. Each returns true
   when the corresponding face/wall should be drawn (no neighbouring cell). */

export function rightFaceVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c, r - 1)
  if (dir === 2) return (c, r) => !has(c, r - 1)
  if (dir === 3) return (c, r) => !has(c, r + 1)
  return (c, r) => !has(c + 1, r)
}
export function leftFaceVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c + 1, r)
  if (dir === 2) return (c, r) => !has(c + 1, r)
  if (dir === 3) return (c, r) => !has(c - 1, r)
  return (c, r) => !has(c, r + 1)
}
export function backRightVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c - 1, r)
  if (dir === 2) return (c, r) => !has(c - 1, r)
  if (dir === 3) return (c, r) => !has(c + 1, r)
  return (c, r) => !has(c, r - 1)
}
export function backLeftVisible(has: Has, dir: Dir): Has {
  if (dir === 1) return (c, r) => !has(c, r + 1)
  if (dir === 2) return (c, r) => !has(c, r + 1)
  if (dir === 3) return (c, r) => !has(c, r - 1)
  return (c, r) => !has(c - 1, r)
}

/** The grid edge that corresponds to the back-right / back-left wall, per dir. */
export function backRightEdge(dir: Dir): Edge {
  return dir === 0 ? 'N' : dir === 3 ? 'E' : 'O'
}
export function backLeftEdge(dir: Dir): Edge {
  return dir === 0 ? 'O' : dir === 2 ? 'S' : dir === 1 ? 'S' : 'N'
}

/** Comparator that orders cells far → near for the painter's algorithm. */
export function depthCompare(dir: Dir): (a: Cell, b: Cell) => number {
  if (dir === 1) return (a, b) => a[0] - a[1] - (b[0] - b[1]) || a[0] - b[0]
  if (dir === 2) return (a, b) => a[0] - a[1] - (b[0] - b[1]) || a[0] - b[0]
  if (dir === 3) return (a, b) => a[1] - a[0] - (b[1] - b[0]) || a[1] - b[1]
  return (a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]
}

export interface IsoBounds {
  minX: number
  minY: number
  width: number
  height: number
}

/** Bounding box that fits the whole floor (tiles + walls + tallest tower). */
export function computeIsoBounds(
  cells: Cell[],
  dir: Dir,
  maxC: number,
  maxR: number,
  topExtra = 0,
  pad = 22,
): IsoBounds {
  if (cells.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const topRise = Math.max(WALL_H, SEAT_MAX_H + topExtra)
  for (const [c, r] of cells) {
    const [x, y] = projectCell(c, r, dir, maxC, maxR)
    minX = Math.min(minX, x - TW)
    maxX = Math.max(maxX, x + TW)
    minY = Math.min(minY, y - TH - topRise)
    maxY = Math.max(maxY, y + TH + THK)
  }
  return { minX: minX - pad, minY: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
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
