/* Floor editor — data model.
   Stored in a fully serializable shape (plain arrays/objects, no Set/Map) so it
   can be persisted as-is and, later, round-tripped through a Salesforce-backed
   repository without conversion. */

export type FloorTool = 'cell' | 'seat' | 'door' | 'window' | 'divider' | 'erase'

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

export interface Floor {
  id: string
  name: string
  cells: Cell[]
  seats: Seat[]
  openings: Opening[]
  dividers: Divider[]
  /** Background image id, or null for none. */
  background: string | null
  /** Background opacity in the [0, 1] range. */
  backgroundOpacity: number
  /** Saved camera rotation for this floor (0..3, 90° steps). */
  dir: Dir
}

export interface Place {
  id: string
  name: string
  floors: Floor[]
}

export interface FloorPlanData {
  /** Schema version, for forward-compatible migrations. */
  v: number
  activePlaceId: string | null
  places: Place[]
}
