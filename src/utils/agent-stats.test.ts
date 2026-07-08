import { describe, expect, it } from 'vitest'
import type { Agent } from '../api/types'
import { capacityColor } from './agent-stats'

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
