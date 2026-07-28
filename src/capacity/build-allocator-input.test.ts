import { describe, expect, it } from 'vitest'
import type { Agent, Queue } from '../api/types'
import { buildAllocatorInput } from './build-allocator-input'
import { sum } from './allocator-engine'

function makeQueue(id: string, name: string, backlog: number): Queue {
  return { id, name, backlog, longest: 0, avg: 0, online: 0 }
}

function makeAgent(
  id: string,
  queueIds: string[],
  status: Agent['status'] = 'online',
): Agent {
  return {
    id,
    name: id,
    role: 'Agent',
    recordUrl: null,
    status,
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: 5,
    used: 0,
    queueIds,
    loginMin: 0,
    photo: null,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skills: [],
  }
}

describe('buildAllocatorInput', () => {
  it('groups online agents by eligibility and keeps sum(current) === total', () => {
    const queues = [
      makeQueue('qA', 'Alpha', 10),
      makeQueue('qB', 'Beta', 5),
      makeQueue('qC', 'Gamma', 20),
    ]
    const agents = [
      makeAgent('a1', ['qA']),
      makeAgent('a2', ['qA', 'qB']),
      makeAgent('a3', ['qA', 'qB']),
      makeAgent('a4', ['qC']),
      makeAgent('a5', ['qB', 'qC']), // multi-member — counts once toward highest backlog
      makeAgent('offline', ['qA'], 'offline'),
    ]

    const input = buildAllocatorInput(agents, queues)
    expect(input.total).toBe(5)
    expect(sum(input.current)).toBe(5)
    expect(input.queues.map((q) => q.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    // a5 has B+C; Gamma backlog 20 > Beta 5 → primary Gamma
    // Profiles: {A}:1, {A,B}:2, {C}:1, {B,C}:1
    expect(input.profiles).toHaveLength(4)
    expect(input.profiles.reduce((s, p) => s + p.cap, 0)).toBe(5)
  })

  it('returns empty current when there are no online agents', () => {
    const queues = [makeQueue('qA', 'Alpha', 0)]
    const input = buildAllocatorInput([makeAgent('x', ['qA'], 'offline')], queues)
    expect(input.total).toBe(0)
    expect(input.current).toEqual([0])
  })
})
