import { describe, expect, it } from 'vitest'
import type { Agent, WorkItem } from '../api/types'
import { capacityColor, groupWork } from './agent-stats'

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

function makeWork(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'w1',
    subject: 'Cas',
    channelKey: 'cas',
    queueId: 'q1',
    agentId: null,
    status: 'queued',
    ageSec: 60,
    ...overrides,
  }
}

describe('groupWork', () => {
  it('agrupa per cua amb els treballs de cada grup ordenats del més antic al més nou', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', queueId: 'q1', ageSec: 100 }),
        makeWork({ id: 'w2', queueId: 'q1', ageSec: 300 }),
        makeWork({ id: 'w3', queueId: 'q2', ageSec: 200 }),
      ],
      'queue',
    )
    expect(groups).toHaveLength(2)
    const q1 = groups.find((group) => group.key === 'q1')
    expect(q1?.items.map((item) => item.id)).toEqual(['w2', 'w1'])
    expect(q1?.oldestAgeSec).toBe(300)
  })

  it('ordena els grups per antiguitat del treball més vell, descendent', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', queueId: 'q1', ageSec: 100 }),
        makeWork({ id: 'w2', queueId: 'q2', ageSec: 500 }),
      ],
      'queue',
    )
    expect(groups.map((group) => group.key)).toEqual(['q2', 'q1'])
  })

  it('compta assignats i en cua dins de cada grup', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', queueId: 'q1', status: 'queued' }),
        makeWork({ id: 'w2', queueId: 'q1', status: 'assigned', agentId: 'a1' }),
      ],
      'queue',
    )
    expect(groups[0]?.counts).toEqual({ assigned: 1, queued: 1 })
  })

  it('agrupa els treballs sense valor de criteri en un grup final amb key null', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', queueId: null, ageSec: 900 }),
        makeWork({ id: 'w2', queueId: 'q1', ageSec: 100 }),
      ],
      'queue',
    )
    expect(groups.map((group) => group.key)).toEqual(['q1', null])
  })

  it('agrupa per agent, amb els no assignats al grup null final', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', agentId: 'a1', status: 'assigned', ageSec: 100 }),
        makeWork({ id: 'w2', agentId: null, status: 'queued', ageSec: 400 }),
      ],
      'agent',
    )
    expect(groups.map((group) => group.key)).toEqual(['a1', null])
  })

  it('agrupa per canal', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', channelKey: 'veu', ageSec: 100 }),
        makeWork({ id: 'w2', channelKey: 'chat', ageSec: 500 }),
        makeWork({ id: 'w3', channelKey: 'veu', ageSec: 300 }),
      ],
      'channel',
    )
    expect(groups.map((group) => group.key)).toEqual(['chat', 'veu'])
    expect(groups.find((group) => group.key === 'veu')?.items).toHaveLength(2)
  })

  it('agrupa per estat', () => {
    const groups = groupWork(
      [
        makeWork({ id: 'w1', status: 'queued', ageSec: 100 }),
        makeWork({ id: 'w2', status: 'assigned', agentId: 'a1', ageSec: 500 }),
      ],
      'status',
    )
    expect(groups.map((group) => group.key)).toEqual(['assigned', 'queued'])
  })

  it('retorna buit sense treballs', () => {
    expect(groupWork([], 'queue')).toEqual([])
  })
})

describe('capacityColor', () => {
  it('és verd amb dos o més slots lliures', () => {
    expect(capacityColor(makeAgent({ max: 5, used: 3 }))).toBe('var(--status-ok)')
    expect(capacityColor(makeAgent({ max: 6, used: 0 }))).toBe('var(--status-ok)')
  })

  it('vira a ambre quan queda un únic slot lliure', () => {
    expect(capacityColor(makeAgent({ max: 5, used: 4 }))).toBe('var(--status-watch)')
  })

  it('vira a vermell quan no queden slots lliures', () => {
    expect(capacityColor(makeAgent({ max: 5, used: 5 }))).toBe('var(--status-alert)')
  })

  it('tracta com a ple una sobrecàrrega (used > max)', () => {
    expect(capacityColor(makeAgent({ max: 5, used: 6 }))).toBe('var(--status-alert)')
  })

  it('manté un to apagat per agents offline, independentment de l’ocupació', () => {
    expect(capacityColor(makeAgent({ status: 'offline', max: 5, used: 0 }))).toBe(
      'var(--text-disabled)',
    )
    expect(capacityColor(makeAgent({ status: 'offline', max: 5, used: 5 }))).toBe(
      'var(--text-disabled)',
    )
  })
})
