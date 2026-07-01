/* Space editor — pure model logic.
   No React, no DOM: every function takes state and returns new immutable state,
   so the rules stay testable in isolation and the hook stays thin. */

import type { Cell, Dir, Divider, Edge, Space, SpacePlanData, OpeningKind, Seat, Folder } from './types'

export const GRID_C = 40
export const GRID_R = 40
const SEED_SIZE = 4
export const UNDO_LIMIT = 10
export const SPACE_SCHEMA_VERSION = 4
export const LOGO_MAX_CHARS = 120_000
export const MAX_FOLDER_DEPTH = 12

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/

/** Accept only well-formed image data-URLs under the size cap; else null. */
export function sanitizeImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length > LOGO_MAX_CHARS) return null
  return IMAGE_DATA_URL.test(value) ? value : null
}

const EDGE_DELTA: Record<Edge, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  O: [-1, 0],
}

/** Read an `active` flag from untrusted input: only an explicit `false` turns it
    off, so legacy records (no flag) and new records both default to active. */
function activeFlag(value: unknown): boolean {
  return value !== false
}

let idCounter = 0

export function makeId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

export function cellKey(c: number, r: number): string {
  return `${c},${r}`
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

/** Build a lookup set of "c,r" keys for the space's cells. */
function makeCellSet(cells: Cell[]): Set<string> {
  return new Set(cells.map(([c, r]) => cellKey(c, r)))
}

function hasCell(space: Space, c: number, r: number): boolean {
  return space.cells.some(([cc, rr]) => cc === c && rr === r)
}

/** An edge is exterior when there is no cell on the other side of it. */
function isExteriorEdge(cellSet: Set<string>, c: number, r: number, edge: Edge): boolean {
  if (!cellSet.has(cellKey(c, r))) return false
  const [dc, dr] = EDGE_DELTA[edge]
  return !cellSet.has(cellKey(c + dc, r + dr))
}

/** An edge is interior when both adjacent cells exist. */
function isInteriorEdge(cellSet: Set<string>, c: number, r: number, edge: Edge): boolean {
  if (!cellSet.has(cellKey(c, r))) return false
  const [dc, dr] = EDGE_DELTA[edge]
  return cellSet.has(cellKey(c + dc, r + dr))
}

/** Normalise a divider edge to its canonical owner (always edge E or S). */
function canonicalDivider(c: number, r: number, edge: Edge): Divider {
  if (edge === 'E' || edge === 'S') return { c, r, edge }
  if (edge === 'O') return { c: c - 1, r, edge: 'E' }
  return { c, r: r - 1, edge: 'S' } // N
}

/* ── Construction ─────────────────────────────────────────────────────── */

export function seedSpace(name: string): Space {
  const cells: Cell[] = []
  for (let r = 0; r < SEED_SIZE; r += 1) {
    for (let c = 0; c < SEED_SIZE; c += 1) {
      cells.push([c, r])
    }
  }
  return {
    id: makeId('space'),
    name,
    cells,
    seats: [],
    openings: [],
    dividers: [],
    dir: 0,
    active: true,
  }
}

export function cloneSpace(space: Space, name: string): Space {
  return {
    id: makeId('space'),
    name,
    cells: space.cells.map(([c, r]) => [c, r] as Cell),
    seats: space.seats.map((seat) => ({ ...seat })),
    openings: space.openings.map((opening) => ({ ...opening })),
    dividers: space.dividers.map((divider) => ({ ...divider })),
    dir: space.dir,
    active: space.active,
  }
}

export function seedFolder(name: string): Folder {
  return { id: makeId('folder'), name, image: null, active: true, folders: [], spaces: [] }
}

export function defaultSpacePlan(): SpacePlanData {
  const space = seedSpace('Planta 1')
  const folder: Folder = { id: makeId('folder'), name: 'Lloc 1', image: null, active: true, folders: [], spaces: [space] }
  return { v: SPACE_SCHEMA_VERSION, activeFolderId: folder.id, activeSpaceId: space.id, folders: [folder] }
}

/* ── Connectivity (the room must stay one 4-connected block, no islands) ── */

/** True when every cell is reachable from the first via 4-connected steps. */
function isConnected(cells: Cell[]): boolean {
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
function rectTouchesArea(space: Space, c0: number, c1: number, r0: number, r1: number): boolean {
  const cellSet = makeCellSet(space.cells)
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

/* ── Tools (space-level, immutable) ───────────────────────────────────── */

/** Add every cell inside the rectangle spanned by start/end (additive, clamped).
    The room must stay one connected block: a rectangle that does not touch the
    existing area is rejected wholesale (the first rectangle on an empty space
    seeds freely). */
export function addCellRect(space: Space, start: Cell, end: Cell): Space {
  const c0 = clamp(Math.min(start[0], end[0]), 0, GRID_C - 1)
  const c1 = clamp(Math.max(start[0], end[0]), 0, GRID_C - 1)
  const r0 = clamp(Math.min(start[1], end[1]), 0, GRID_R - 1)
  const r1 = clamp(Math.max(start[1], end[1]), 0, GRID_R - 1)

  // Reject a disconnected rectangle (unless this is the first area painted).
  if (space.cells.length > 0 && !rectTouchesArea(space, c0, c1, r0, r1)) return space

  const cellSet = makeCellSet(space.cells)
  const cells = [...space.cells]
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
  if (!added) return space
  // Newly added cells can turn an exterior edge interior, invalidating openings.
  return sanitizeSpace({ ...space, cells })
}

/** Remove a cell along with its seat and any orphaned openings/dividers.
    An erase that would split the room into separate islands is rejected. */
export function eraseCell(space: Space, c: number, r: number): Space {
  if (!hasCell(space, c, r)) return space
  // Two-step erase: while a seat sits on the cell, the first erase removes only
  // the seat (and its agent) and keeps the space area. A second erase, now that
  // the cell is bare, removes the area itself.
  const hasSeat = space.seats.some((seat) => seat.c === c && seat.r === r)
  if (hasSeat) {
    return { ...space, seats: space.seats.filter((seat) => !(seat.c === c && seat.r === r)) }
  }
  const cells = space.cells.filter(([cc, rr]) => !(cc === c && rr === r))
  if (!isConnected(cells)) return space
  return sanitizeSpace({ ...space, cells })
}

/** Toggle an empty seat on an existing cell. */
export function toggleSeat(space: Space, c: number, r: number): Space {
  if (!hasCell(space, c, r)) return space
  const exists = space.seats.some((seat) => seat.c === c && seat.r === r)
  if (exists) {
    return { ...space, seats: space.seats.filter((seat) => !(seat.c === c && seat.r === r)) }
  }
  return { ...space, seats: [...space.seats, { c, r, agentId: null }] }
}

/** Assign (or clear, with agentId null) an agent to the seat at c,r. */
export function assignAgentToSeat(space: Space, c: number, r: number, agentId: string | null): Space {
  if (!hasCell(space, c, r)) return space
  // An agent can only occupy one seat: clear it from any other seat first.
  let seats = agentId
    ? space.seats.map((seat) => (seat.agentId === agentId ? { ...seat, agentId: null } : seat))
    : space.seats

  const index = seats.findIndex((seat) => seat.c === c && seat.r === r)
  if (index >= 0) {
    seats = seats.map((seat, i) => (i === index ? { ...seat, agentId } : seat))
  } else {
    seats = [...seats, { c, r, agentId }]
  }
  return { ...space, seats }
}

/** Toggle a door/window on an exterior edge (replacing the other kind if present). */
export function toggleOpening(space: Space, c: number, r: number, edge: Edge, kind: OpeningKind): Space {
  const cellSet = makeCellSet(space.cells)
  if (!isExteriorEdge(cellSet, c, r, edge)) return space
  const existing = space.openings.find((o) => o.c === c && o.r === r && o.edge === edge)
  if (existing && existing.kind === kind) {
    return { ...space, openings: space.openings.filter((o) => o !== existing) }
  }
  const without = space.openings.filter((o) => !(o.c === c && o.r === r && o.edge === edge))
  return { ...space, openings: [...without, { c, r, edge, kind }] }
}

/** Toggle an interior divider (stored canonically). */
export function toggleDivider(space: Space, c: number, r: number, edge: Edge): Space {
  const cellSet = makeCellSet(space.cells)
  if (!isInteriorEdge(cellSet, c, r, edge)) return space
  const div = canonicalDivider(c, r, edge)
  const existing = space.dividers.find((d) => d.c === div.c && d.r === div.r && d.edge === div.edge)
  if (existing) {
    return { ...space, dividers: space.dividers.filter((d) => d !== existing) }
  }
  return { ...space, dividers: [...space.dividers, div] }
}

/** Remove an opening and/or divider sitting on the given edge. */
export function eraseEdge(space: Space, c: number, r: number, edge: Edge): Space {
  const openings = space.openings.filter((o) => !(o.c === c && o.r === r && o.edge === edge))
  const div = canonicalDivider(c, r, edge)
  const dividers = space.dividers.filter((d) => !(d.c === div.c && d.r === div.r && d.edge === div.edge))
  if (openings.length === space.openings.length && dividers.length === space.dividers.length) {
    return space
  }
  return { ...space, openings, dividers }
}

/* ── Sanitisation ─────────────────────────────────────────────────────── */

/** Validate and clean a single space from any (possibly untrusted) input. */
function sanitizeSpace(raw: unknown): Space {
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
  const openings: Space['openings'] = []
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
    id: typeof source.id === 'string' && source.id ? source.id : makeId('space'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 40) : 'Planta',
    cells,
    seats,
    openings,
    dividers,
    dir,
    active: activeFlag(source.active),
  }
}

/** Validate and clean a folder subtree from untrusted input. Empty folders are
    kept (intentional organisation); recursion is bounded by MAX_FOLDER_DEPTH. */
export function sanitizeFolder(raw: unknown, depth: number): Folder | null {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const spaces = asArray(src.spaces)
    .map((space) => sanitizeSpace(space))
    .filter((space) => space.cells.length > 0)
  const folders = depth >= MAX_FOLDER_DEPTH
    ? []
    : asArray(src.folders)
        .map((child) => sanitizeFolder(child, depth + 1))
        .filter((child): child is Folder => child !== null)
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeId('folder'),
    name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 40) : 'Carpeta',
    image: sanitizeImage(src.image),
    active: activeFlag(src.active),
    folders,
    spaces,
  }
}

/** Collect every folder id in the tree (for active-id validation). */
function collectFolderIds(folders: Folder[], out: Set<string>): void {
  for (const f of folders) { out.add(f.id); collectFolderIds(f.folders, out) }
}

/** Collect every space id in the tree. */
function collectSpaceIds(folders: Folder[], out: Set<string>): void {
  for (const f of folders) {
    for (const s of f.spaces) out.add(s.id)
    collectSpaceIds(f.folders, out)
  }
}

/** First space id found in DFS order, or null. */
function firstSpaceId(folders: Folder[]): string | null {
  for (const f of folders) {
    if (f.spaces.length > 0) return f.spaces[0].id
    const nested = firstSpaceId(f.folders)
    if (nested) return nested
  }
  return null
}

/** Stable id for the synthetic site when upgrading an Apex v2 wire plan (flat
    `places` with no `sites`). Keeps `activeSiteId` stable across reloads. */
export const LEGACY_WIRE_SITE_ID = 'legacy-site'

/** Wire format the Apex REST handler reads/writes today (schema v2, flat places). */
export interface WireSpacePlanV2 {
  v: 2
  activePlaceId: string | null
  places: Place[]
}

/** Accept a v3 plan (`sites`) or the v2 Apex wire shape (`places` at root). */
export function parseStoredSpacePlan(raw: unknown): SpacePlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>

  if (data.v === SPACE_SCHEMA_VERSION && Array.isArray(data.sites)) {
    return sanitizeSpacePlan(data)
  }

  if (Array.isArray(data.places)) {
    const places = data.places
      .map((place) => sanitizePlace(place))
      .filter((place): place is Place => place !== null)
    if (places.length === 0) return null
    const activePlaceId =
      typeof data.activePlaceId === 'string' && places.some((p) => p.id === data.activePlaceId)
        ? data.activePlaceId
        : places[0].id
    return sanitizeSpacePlan({
      v: SPACE_SCHEMA_VERSION,
      activeSiteId: LEGACY_WIRE_SITE_ID,
      activePlaceId,
      sites: [{ id: LEGACY_WIRE_SITE_ID, name: 'Site 1', image: null, places, active: true }],
    })
  }

  return null
}

/** Flatten a v3 plan to the v2 wire shape the Apex service persists today. Site
    names/logos are not stored server-side until Site__c exists. */
export function toWireSpacePlan(data: SpacePlanData): WireSpacePlanV2 {
  const clean = sanitizeSpacePlan(data) ?? data
  return {
    v: 2,
    activePlaceId: clean.activePlaceId,
    places: clean.sites.flatMap((site) => site.places),
  }
}

/** Validate a whole plan from storage; returns null when nothing usable. */
export function sanitizeSpacePlan(raw: unknown): SpacePlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== SPACE_SCHEMA_VERSION) return null
  if (!Array.isArray(data.folders)) return null

  const folders = data.folders
    .map((f) => sanitizeFolder(f, 1))
    .filter((f): f is Folder => f !== null)
  if (folders.length === 0) return null

  const folderIds = new Set<string>()
  collectFolderIds(folders, folderIds)
  const spaceIds = new Set<string>()
  collectSpaceIds(folders, spaceIds)

  const activeFolderId =
    typeof data.activeFolderId === 'string' && folderIds.has(data.activeFolderId)
      ? data.activeFolderId
      : folders[0].id
  const activeSpaceId =
    typeof data.activeSpaceId === 'string' && spaceIds.has(data.activeSpaceId)
      ? data.activeSpaceId
      : firstSpaceId(folders)

  return { v: SPACE_SCHEMA_VERSION, activeFolderId, activeSpaceId, folders }
}

/** Generate a unique name within a list of existing names by adding a numeric
    suffix (" 2", " 3", …) on collision. */
export function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

/** Validate an imported plan and turn its sites into brand-new records: every
    site, place and space gets a freshly generated id (so they never collide with
    existing org records) and site names are de-duplicated against
    `existingNames`. Logos are preserved. Additive: nothing here mutates the
    current plan. Returns null when the input is not a usable plan. */
export function prepareImportedSites(raw: unknown, existingNames: string[]): Site[] | null {
  const clean = sanitizeSpacePlan(raw)
  if (!clean) return null

  const names = [...existingNames]
  return clean.sites.map((site) => {
    const name = uniqueName(site.name, names)
    names.push(name)
    return {
      id: makeId('site'),
      name,
      image: site.image,
      active: site.active,
      places: site.places.map((place) => ({
        id: makeId('place'),
        name: place.name,
        active: place.active,
        spaces: place.spaces.map((space) => ({ ...space, id: makeId('space') })),
      })),
    }
  })
}

/* ── Live-view visibility ─────────────────────────────────────────────────
   Home and the space view hide anything inactive or hanging off something
   inactive: a folder inside an inactive ancestor is hidden. The editor always
   shows everything so inactive items can be toggled back on. */

/** Active spaces of a folder. */
export function visibleSpaces(folder: Folder): Space[] {
  return folder.spaces.filter((space) => space.active)
}

export interface VisibleSpaceFolder {
  folder: Folder
  /** Ancestor names ending with the folder's own name, for a breadcrumb label. */
  path: string[]
}

/** Every active folder (all ancestors active) that directly holds at least one
    active space, in DFS order, each tagged with its name path. */
export function visibleSpaceFolders(data: SpacePlanData): VisibleSpaceFolder[] {
  const out: VisibleSpaceFolder[] = []
  const walk = (folders: Folder[], parents: string[]): void => {
    for (const folder of folders) {
      if (!folder.active) continue
      const path = [...parents, folder.name]
      if (visibleSpaces(folder).length > 0) out.push({ folder, path })
      walk(folder.folders, path)
    }
  }
  walk(data.folders, [])
  return out
}

/** Stable signature used to detect unsaved changes. */
export function spacePlanSignature(data: SpacePlanData): string {
  return JSON.stringify(data)
}
