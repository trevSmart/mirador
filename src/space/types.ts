/* Space editor — data model.
   Stored in a fully serializable shape (plain arrays/objects, no Set/Map) so it
   can be persisted as-is and, later, round-tripped through a Salesforce-backed
   repository without conversion. */

export type SpaceTool = 'cell' | 'seat' | 'door' | 'window' | 'divider' | 'erase'

/** Cell edge. O = Oest (west). */
export type Edge = 'N' | 'S' | 'E' | 'O'

/** Camera rotation for isometric view (0..3, each step = 90°). */
export type Dir = 0 | 1 | 2 | 3

export type OpeningKind = 'door' | 'window'

/** Grid cell as a [column, row] tuple. */
export type Cell = [number, number]

/** A placed agent slot. `agentId` null = empty placeholder seat. */
export interface Seat {
  c: number
  r: number
  agentId: string | null
}

/** Door/window on an EXTERIOR edge (no neighbouring cell in that direction). */
export interface Opening {
  c: number
  r: number
  edge: Edge
  kind: OpeningKind
}

/** Interior wall between two adjacent cells. Stored in canonical form (edge E or S). */
export interface Divider {
  c: number
  r: number
  edge: 'E' | 'S'
}

export interface Space {
  id: string
  name: string
  cells: Cell[]
  seats: Seat[]
  openings: Opening[]
  dividers: Divider[]
  /** Saved camera rotation for this space (0..3, 90° steps). */
  dir: Dir
  /** Whether the space shows up in live views (home/space). Defaults to true. */
  active: boolean
}

export interface Place {
  id: string
  name: string
  spaces: Space[]
  /** Whether the place (and its spaces) show up in live views. Defaults to true. */
  active: boolean
}

export interface Site {
  id: string
  name: string
  /** Logo as a base64 data-URL ("data:image/png;base64,…"), or null. */
  image: string | null
  places: Place[]
  /** Whether the site (and everything under it) shows up in live views. Defaults to true. */
  active: boolean
}

export interface SpacePlanData {
  /** Schema version, for forward-compatible migrations. */
  v: number
  activeSiteId: string | null
  activePlaceId: string | null
  sites: Site[]
}
