/* Floor editor — pure model logic.
   No React, no DOM: every function takes state and returns new immutable state,
   so the rules stay testable in isolation and the hook stays thin. */

import type { Cell, Dir, Divider, Edge, Floor, FloorPlanData, OpeningKind, Place, Seat } from './types'

export const GRID_C = 50
export const GRID_R = 50
export const SEED_SIZE = 4
export const UNDO_LIMIT = 10
export const FLOOR_SCHEMA_VERSION = 2

const EDGE_DELTA: Record<Edge, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  O: [-1, 0],
}

let idCounter = 0

export function makeId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

export function cellKey(c: number, r: number): string {
  return `${c},${r}`
}

export function parseKey(key: string): Cell {
  const [c, r] = key.split(',').map(Number)
  return [c, r]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isEdge(value: unknown): value is Edge {
  return value === 'N' || value === 'S' || value === 'E' || value === 'O'
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Build a lookup set of "c,r" keys for the floor's cells. */
export function makeCellSet(cells: Cell[]): Set<string> {
  return new Set(cells.map(([c, r]) => cellKey(c, r)))
}

export function hasCell(floor: Floor, c: number, r: number): boolean {
  return floor.cells.some(([cc, rr]) => cc === c && rr === r)
}

/** An edge is exterior when there is no cell on the other side of it. */
export function isExteriorEdge(cellSet: Set<string>, c: number, r: number, edge: Edge): boolean {
  if (!cellSet.has(cellKey(c, r))) return false
  const [dc, dr] = EDGE_DELTA[edge]
  return !cellSet.has(cellKey(c + dc, r + dr))
}

/** An edge is interior when both adjacent cells exist. */
export function isInteriorEdge(cellSet: Set<string>, c: number, r: number, edge: Edge): boolean {
  if (!cellSet.has(cellKey(c, r))) return false
  const [dc, dr] = EDGE_DELTA[edge]
  return cellSet.has(cellKey(c + dc, r + dr))
}

/** Normalise a divider edge to its canonical owner (always edge E or S). */
export function canonicalDivider(c: number, r: number, edge: Edge): Divider {
  if (edge === 'E' || edge === 'S') return { c, r, edge }
  if (edge === 'O') return { c: c - 1, r, edge: 'E' }
  return { c, r: r - 1, edge: 'S' } // N
}

/* ── Construction ─────────────────────────────────────────────────────── */

export function seedFloor(name: string): Floor {
  const cells: Cell[] = []
  for (let r = 0; r < SEED_SIZE; r += 1) {
    for (let c = 0; c < SEED_SIZE; c += 1) {
      cells.push([c, r])
    }
  }
  return {
    id: makeId('floor'),
    name,
    cells,
    seats: [],
    openings: [],
    dividers: [],
    dir: 0,
  }
}

export function cloneFloor(floor: Floor, name: string): Floor {
  return {
    id: makeId('floor'),
    name,
    cells: floor.cells.map(([c, r]) => [c, r] as Cell),
    seats: floor.seats.map((seat) => ({ ...seat })),
    openings: floor.openings.map((opening) => ({ ...opening })),
    dividers: floor.dividers.map((divider) => ({ ...divider })),
    dir: floor.dir,
  }
}

export function defaultFloorPlan(): FloorPlanData {
  const place: Place = { id: makeId('place'), name: 'Lloc 1', floors: [seedFloor('Planta 1')] }
  return { v: FLOOR_SCHEMA_VERSION, activePlaceId: place.id, places: [place] }
}

/* ── Connectivity (the room must stay one 4-connected block, no islands) ── */

/** True when every cell is reachable from the first via 4-connected steps. */
export function isConnected(cells: Cell[]): boolean {
  if (cells.length <= 1) return true
  const all = makeCellSet(cells)
  const seen = new Set<string>()
  const [start] = cells
  const stack: Cell[] = [start]
  seen.add(cellKey(start[0], start[1]))
  while (stack.length > 0) {
    const [c, r] = stack.pop() as Cell
    for (const [nc, nr] of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ] as Cell[]) {
      const key = cellKey(nc, nr)
      if (all.has(key) && !seen.has(key)) {
        seen.add(key)
        stack.push([nc, nr])
      }
    }
  }
  return seen.size === cells.length
}

/** True when a rectangle's cells are adjacent to (or overlap) the existing area. */
function rectTouchesArea(floor: Floor, c0: number, c1: number, r0: number, r1: number): boolean {
  const cellSet = makeCellSet(floor.cells)
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (
        cellSet.has(cellKey(c, r)) ||
        cellSet.has(cellKey(c + 1, r)) ||
        cellSet.has(cellKey(c - 1, r)) ||
        cellSet.has(cellKey(c, r + 1)) ||
        cellSet.has(cellKey(c, r - 1))
      ) {
        return true
      }
    }
  }
  return false
}

/* ── Tools (floor-level, immutable) ───────────────────────────────────── */

/** Add every cell inside the rectangle spanned by start/end (additive, clamped).
    The room must stay one connected block: a rectangle that does not touch the
    existing area is rejected wholesale (the first rectangle on an empty floor
    seeds freely). */
export function addCellRect(floor: Floor, start: Cell, end: Cell): Floor {
  const c0 = clamp(Math.min(start[0], end[0]), 0, GRID_C - 1)
  const c1 = clamp(Math.max(start[0], end[0]), 0, GRID_C - 1)
  const r0 = clamp(Math.min(start[1], end[1]), 0, GRID_R - 1)
  const r1 = clamp(Math.max(start[1], end[1]), 0, GRID_R - 1)

  // Reject a disconnected rectangle (unless this is the first area painted).
  if (floor.cells.length > 0 && !rectTouchesArea(floor, c0, c1, r0, r1)) return floor

  const cellSet = makeCellSet(floor.cells)
  const cells = [...floor.cells]
  let added = false
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const key = cellKey(c, r)
      if (!cellSet.has(key)) {
        cellSet.add(key)
        cells.push([c, r])
        added = true
      }
    }
  }
  if (!added) return floor
  // Newly added cells can turn an exterior edge interior, invalidating openings.
  return sanitizeFloor({ ...floor, cells })
}

/** Remove a cell along with its seat and any orphaned openings/dividers.
    An erase that would split the room into separate islands is rejected. */
export function eraseCell(floor: Floor, c: number, r: number): Floor {
  if (!hasCell(floor, c, r)) return floor
  const cells = floor.cells.filter(([cc, rr]) => !(cc === c && rr === r))
  if (!isConnected(cells)) return floor
  const seats = floor.seats.filter((seat) => !(seat.c === c && seat.r === r))
  return sanitizeFloor({ ...floor, cells, seats })
}

/** Toggle an empty seat on an existing cell. */
export function toggleSeat(floor: Floor, c: number, r: number): Floor {
  if (!hasCell(floor, c, r)) return floor
  const exists = floor.seats.some((seat) => seat.c === c && seat.r === r)
  if (exists) {
    return { ...floor, seats: floor.seats.filter((seat) => !(seat.c === c && seat.r === r)) }
  }
  return { ...floor, seats: [...floor.seats, { c, r, agentId: null }] }
}

/** Assign (or clear, with agentId null) an agent to the seat at c,r. */
export function assignAgentToSeat(floor: Floor, c: number, r: number, agentId: string | null): Floor {
  if (!hasCell(floor, c, r)) return floor
  // An agent can only occupy one seat: clear it from any other seat first.
  let seats = agentId
    ? floor.seats.map((seat) => (seat.agentId === agentId ? { ...seat, agentId: null } : seat))
    : floor.seats

  const index = seats.findIndex((seat) => seat.c === c && seat.r === r)
  if (index >= 0) {
    seats = seats.map((seat, i) => (i === index ? { ...seat, agentId } : seat))
  } else {
    seats = [...seats, { c, r, agentId }]
  }
  return { ...floor, seats }
}

/** Toggle a door/window on an exterior edge (replacing the other kind if present). */
export function toggleOpening(floor: Floor, c: number, r: number, edge: Edge, kind: OpeningKind): Floor {
  const cellSet = makeCellSet(floor.cells)
  if (!isExteriorEdge(cellSet, c, r, edge)) return floor
  const existing = floor.openings.find((o) => o.c === c && o.r === r && o.edge === edge)
  if (existing && existing.kind === kind) {
    return { ...floor, openings: floor.openings.filter((o) => o !== existing) }
  }
  const without = floor.openings.filter((o) => !(o.c === c && o.r === r && o.edge === edge))
  return { ...floor, openings: [...without, { c, r, edge, kind }] }
}

/** Toggle an interior divider (stored canonically). */
export function toggleDivider(floor: Floor, c: number, r: number, edge: Edge): Floor {
  const cellSet = makeCellSet(floor.cells)
  if (!isInteriorEdge(cellSet, c, r, edge)) return floor
  const div = canonicalDivider(c, r, edge)
  const existing = floor.dividers.find((d) => d.c === div.c && d.r === div.r && d.edge === div.edge)
  if (existing) {
    return { ...floor, dividers: floor.dividers.filter((d) => d !== existing) }
  }
  return { ...floor, dividers: [...floor.dividers, div] }
}

/** Remove an opening and/or divider sitting on the given edge. */
export function eraseEdge(floor: Floor, c: number, r: number, edge: Edge): Floor {
  const openings = floor.openings.filter((o) => !(o.c === c && o.r === r && o.edge === edge))
  const div = canonicalDivider(c, r, edge)
  const dividers = floor.dividers.filter((d) => !(d.c === div.c && d.r === div.r && d.edge === div.edge))
  if (openings.length === floor.openings.length && dividers.length === floor.dividers.length) {
    return floor
  }
  return { ...floor, openings, dividers }
}

/* ── Sanitisation ─────────────────────────────────────────────────────── */

/** Validate and clean a single floor from any (possibly untrusted) input. */
export function sanitizeFloor(raw: unknown): Floor {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const cellSet = new Set<string>()
  const cells: Cell[] = []
  for (const item of asArray(source.cells)) {
    if (!Array.isArray(item)) continue
    const c = num(item[0])
    const r = num(item[1])
    if (c === null || r === null || !Number.isInteger(c) || !Number.isInteger(r)) continue
    if (c < 0 || c >= GRID_C || r < 0 || r >= GRID_R) continue
    const key = cellKey(c, r)
    if (cellSet.has(key)) continue
    cellSet.add(key)
    cells.push([c, r])
  }

  const seatSet = new Set<string>()
  const seenAgents = new Set<string>()
  const seats: Seat[] = []
  for (const item of asArray(source.seats)) {
    const seat = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const c = num(seat.c)
    const r = num(seat.r)
    if (c === null || r === null) continue
    const key = cellKey(c, r)
    if (!cellSet.has(key) || seatSet.has(key)) continue
    let agentId = typeof seat.agentId === 'string' && seat.agentId ? seat.agentId : null
    if (agentId && seenAgents.has(agentId)) agentId = null
    if (agentId) seenAgents.add(agentId)
    seatSet.add(key)
    seats.push({ c, r, agentId })
  }

  const openSet = new Set<string>()
  const openings: Floor['openings'] = []
  for (const item of asArray(source.openings)) {
    const opening = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const c = num(opening.c)
    const r = num(opening.r)
    const edge = opening.edge
    const kind = opening.kind
    if (c === null || r === null || !isEdge(edge)) continue
    if (kind !== 'door' && kind !== 'window') continue
    if (!isExteriorEdge(cellSet, c, r, edge)) continue
    const key = `${c},${r},${edge}`
    if (openSet.has(key)) continue
    openSet.add(key)
    openings.push({ c, r, edge, kind })
  }

  const divSet = new Set<string>()
  const dividers: Divider[] = []
  for (const item of asArray(source.dividers)) {
    const divider = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const c = num(divider.c)
    const r = num(divider.r)
    const edge = divider.edge
    if (c === null || r === null || !isEdge(edge)) continue
    const canon = canonicalDivider(c, r, edge)
    if (!isInteriorEdge(cellSet, canon.c, canon.r, canon.edge)) continue
    const key = `${canon.c},${canon.r},${canon.edge}`
    if (divSet.has(key)) continue
    divSet.add(key)
    dividers.push(canon)
  }

  const rawDir = num(source.dir)
  const dir: Dir = rawDir === 1 || rawDir === 2 || rawDir === 3 ? rawDir : 0
  return {
    id: typeof source.id === 'string' && source.id ? source.id : makeId('floor'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 40) : 'Planta',
    cells,
    seats,
    openings,
    dividers,
    dir,
  }
}

/** Validate a whole plan from storage; returns null when nothing usable. */
export function sanitizeFloorPlan(raw: unknown): FloorPlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== FLOOR_SCHEMA_VERSION) return null   // discard old/unknown schema
  if (!Array.isArray(data.places)) return null

  const places: Place[] = []
  for (const item of data.places) {
    const place = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const floors = asArray(place.floors)
      .map((floor) => sanitizeFloor(floor))
      .filter((floor) => floor.cells.length > 0)
    if (floors.length === 0) continue
    places.push({
      id: typeof place.id === 'string' && place.id ? place.id : makeId('place'),
      name:
        typeof place.name === 'string' && place.name.trim() ? place.name.trim().slice(0, 40) : 'Lloc',
      floors,
    })
  }

  if (places.length === 0) return null
  const activePlaceId =
    typeof data.activePlaceId === 'string' && places.some((p) => p.id === data.activePlaceId)
      ? data.activePlaceId
      : places[0].id

  return { v: FLOOR_SCHEMA_VERSION, activePlaceId, places }
}

/** Stable signature used to detect unsaved changes. */
export function floorPlanSignature(data: FloorPlanData): string {
  return JSON.stringify(data)
}
