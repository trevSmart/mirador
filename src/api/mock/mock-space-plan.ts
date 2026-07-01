import { SPACE_SCHEMA_VERSION } from '../../space/space-plan-model'
import type { Cell, Edge, Space, SpacePlanData, Opening, OpeningKind, Place, Seat, Site } from '../../space/types'
import { MOCK_AGENT, type MockAgentKey } from './mock-ids'

const MOCK_PLACE_ID = 'mock-place-cc'
const MOCK_SITE_ID = 'mock-site-cc'
const MOCK_SPACE_VENDES = 'mock-space-vendes'
const MOCK_SPACE_ATENCIO = 'mock-space-atencio'
const MOCK_SPACE_SUPORT = 'mock-space-suport'

type SeatDef = { c: number; r: number; agentId: MockAgentKey | null }
type OpeningDef = { lc: number; lr: number; edge: Edge; kind: OpeningKind }

function rect(c0: number, r0: number, width: number, height: number): Cell[] {
  const cells: Cell[] = []
  for (let r = r0; r < r0 + height; r += 1) {
    for (let c = c0; c < c0 + width; c += 1) {
      cells.push([c, r])
    }
  }
  return cells
}

function seatsAt(originC: number, originR: number, defs: SeatDef[]): Seat[] {
  return defs.map(({ c, r, agentId }) => ({
    c: originC + c,
    r: originR + r,
    agentId: agentId ? MOCK_AGENT[agentId] : null,
  }))
}

/** Map room-local coords (0..width-1, 0..height-1) to absolute grid openings. */
function roomOpenings(
  originC: number,
  originR: number,
  defs: OpeningDef[],
): Opening[] {
  return defs.map(({ lc, lr, edge, kind }) => ({
    c: originC + lc,
    r: originR + lr,
    edge,
    kind,
  }))
}

function buildSpace(
  id: string,
  name: string,
  originC: number,
  originR: number,
  width: number,
  height: number,
  seatDefs: SeatDef[],
  openingDefs: OpeningDef[],
): Space {
  return {
    id,
    name,
    cells: rect(originC, originR, width, height),
    seats: seatsAt(originC, originR, seatDefs),
    openings: roomOpenings(originC, originR, openingDefs),
    dividers: [],
    dir: 0,
    active: true,
  }
}

/** Predefined contact-center spaces for mock mode, with seats bound to mock agent ids. */
export function createMockSpacePlan(): SpacePlanData {
  const vendes = buildSpace(
    MOCK_SPACE_VENDES,
    'Planta Vendes',
    2,
    2,
    14,
    5,
    [
      { c: 1, r: 1, agentId: 'a1' },
      { c: 3, r: 1, agentId: 'a6' },
      { c: 5, r: 1, agentId: 'a12' },
      { c: 7, r: 1, agentId: 'a21' },
      { c: 9, r: 1, agentId: 'a28' },
      { c: 11, r: 1, agentId: null },
      { c: 2, r: 3, agentId: 'a5' },
      { c: 4, r: 3, agentId: 'a11' },
      { c: 6, r: 3, agentId: 'a14' },
      { c: 8, r: 3, agentId: 'a19' },
      { c: 10, r: 3, agentId: 'a23' },
      { c: 12, r: 3, agentId: 'a33' },
    ],
    [
      { lc: 7, lr: 4, edge: 'S', kind: 'door' },
      { lc: 1, lr: 4, edge: 'S', kind: 'door' },
      { lc: 0, lr: 2, edge: 'O', kind: 'door' },
      { lc: 3, lr: 0, edge: 'N', kind: 'window' },
      { lc: 7, lr: 0, edge: 'N', kind: 'window' },
      { lc: 11, lr: 0, edge: 'N', kind: 'window' },
      { lc: 13, lr: 1, edge: 'E', kind: 'window' },
      { lc: 13, lr: 3, edge: 'E', kind: 'window' },
    ],
  )

  const atencio = buildSpace(
    MOCK_SPACE_ATENCIO,
    'Planta Atenció',
    2,
    9,
    12,
    4,
    [
      { c: 1, r: 1, agentId: 'a0' },
      { c: 3, r: 1, agentId: 'a4' },
      { c: 5, r: 1, agentId: 'a8' },
      { c: 7, r: 1, agentId: 'a13' },
      { c: 9, r: 1, agentId: 'a18' },
      { c: 2, r: 2, agentId: 'a26' },
      { c: 4, r: 2, agentId: 'a31' },
      { c: 6, r: 2, agentId: null },
    ],
    [
      { lc: 6, lr: 3, edge: 'S', kind: 'door' },
      { lc: 0, lr: 1, edge: 'O', kind: 'door' },
      { lc: 2, lr: 0, edge: 'N', kind: 'window' },
      { lc: 6, lr: 0, edge: 'N', kind: 'window' },
      { lc: 10, lr: 0, edge: 'N', kind: 'window' },
      { lc: 11, lr: 2, edge: 'E', kind: 'window' },
    ],
  )

  const suport = buildSpace(
    MOCK_SPACE_SUPORT,
    'Planta Suport',
    2,
    16,
    14,
    5,
    [
      { c: 1, r: 1, agentId: 'a2' },
      { c: 3, r: 1, agentId: 'a3' },
      { c: 5, r: 1, agentId: 'a7' },
      { c: 7, r: 1, agentId: 'a9' },
      { c: 9, r: 1, agentId: 'a10' },
      { c: 11, r: 1, agentId: 'a15' },
      { c: 2, r: 3, agentId: 'a16' },
      { c: 4, r: 3, agentId: 'a17' },
      { c: 6, r: 3, agentId: 'a20' },
      { c: 8, r: 3, agentId: 'a22' },
      { c: 10, r: 3, agentId: 'a29' },
      { c: 12, r: 3, agentId: 'a32' },
    ],
    [
      { lc: 7, lr: 4, edge: 'S', kind: 'door' },
      { lc: 12, lr: 4, edge: 'S', kind: 'door' },
      { lc: 13, lr: 2, edge: 'E', kind: 'door' },
      { lc: 2, lr: 0, edge: 'N', kind: 'window' },
      { lc: 6, lr: 0, edge: 'N', kind: 'window' },
      { lc: 10, lr: 0, edge: 'N', kind: 'window' },
      { lc: 0, lr: 1, edge: 'O', kind: 'window' },
      { lc: 0, lr: 3, edge: 'O', kind: 'window' },
    ],
  )

  const place: Place = {
    id: MOCK_PLACE_ID,
    name: 'Contact Center Barcelona',
    spaces: [vendes, atencio, suport],
    active: true,
  }

  const site: Site = { id: MOCK_SITE_ID, name: 'Seu Central', image: null, places: [place], active: true }
  return {
    v: SPACE_SCHEMA_VERSION,
    activeSiteId: site.id,
    activePlaceId: place.id,
    sites: [site],
  }
}
