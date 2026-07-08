import { describe, expect, it } from 'vitest'
import type { Agent, PresenceStatusOption } from '../api/types'
import {
  ALL_FILTER,
  CONNECTED_FILTER,
  buildPresenceFilters,
  countForFilter,
  filterConnected,
  filterRoster,
  getConnectedAgents,
} from './agent-presence-filter'

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    name: 'Marta',
    role: 'Agent',
    recordUrl: null,
    status: 'online',
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: 5,
    used: 0,
    queueIds: [],
    loginMin: 0,
    photo: null,
    chans: {},
    work: [],
    skills: [],
    ...overrides,
  } as Agent
}

const CATALOG: PresenceStatusOption[] = [
  { id: 'ps_avail', label: 'Disponible' },
  { id: 'ps_lunch', label: 'Dinar' },
  { id: 'ps_offline', label: 'Desconnectat' },
]

// Two available, one at lunch, one offline (no presence id).
const AGENTS: Agent[] = [
  makeAgent({ id: 'a1', presenceStatusId: 'ps_avail' }),
  makeAgent({ id: 'a2', presenceStatusId: 'ps_avail' }),
  makeAgent({ id: 'a3', status: 'away', presenceStatusId: 'ps_lunch' }),
  makeAgent({ id: 'a4', status: 'offline', presenceStatusId: null }),
]

describe('getConnectedAgents', () => {
  it('exclou els agents sense presence status id', () => {
    expect(getConnectedAgents(AGENTS).map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })
})

describe('buildPresenceFilters', () => {
  it('compta per status i manté visibles els chips a zero', () => {
    const connected = getConnectedAgents(AGENTS)
    expect(buildPresenceFilters(connected, CATALOG)).toEqual([
      { id: 'ps_avail', label: 'Disponible', count: 2 },
      { id: 'ps_lunch', label: 'Dinar', count: 1 },
      { id: 'ps_offline', label: 'Desconnectat', count: 0 },
    ])
  })
})

describe('filterConnected (semàntica Home)', () => {
  it('CONNECTED i ALL retornen tots els connectats', () => {
    const connected = getConnectedAgents(AGENTS)
    expect(filterConnected(connected, CONNECTED_FILTER)).toHaveLength(3)
    expect(filterConnected(connected, ALL_FILTER)).toHaveLength(3)
  })

  it('un status id concret filtra', () => {
    const connected = getConnectedAgents(AGENTS)
    expect(filterConnected(connected, 'ps_avail').map((a) => a.id)).toEqual(['a1', 'a2'])
  })
})

describe('filterRoster (semàntica Agents)', () => {
  it('ALL inclou els offline', () => {
    expect(filterRoster(AGENTS, ALL_FILTER)).toHaveLength(4)
  })

  it('CONNECTED exclou els offline', () => {
    expect(filterRoster(AGENTS, CONNECTED_FILTER).map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('un status id concret filtra sobre tot el roster', () => {
    expect(filterRoster(AGENTS, 'ps_lunch').map((a) => a.id)).toEqual(['a3'])
  })
})

describe('countForFilter', () => {
  it('retorna el total de connectats per CONNECTED i ALL', () => {
    const connected = getConnectedAgents(AGENTS)
    const chips = buildPresenceFilters(connected, CATALOG)
    expect(countForFilter(connected, chips, CONNECTED_FILTER)).toBe(3)
    expect(countForFilter(connected, chips, ALL_FILTER)).toBe(3)
  })

  it('retorna el count del chip per un status id', () => {
    const connected = getConnectedAgents(AGENTS)
    const chips = buildPresenceFilters(connected, CATALOG)
    expect(countForFilter(connected, chips, 'ps_avail')).toBe(2)
    expect(countForFilter(connected, chips, 'ps_offline')).toBe(0)
    expect(countForFilter(connected, chips, 'unknown')).toBe(0)
  })
})
