import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { MiradorClient } from '../../mirador-client'
import type { SnapshotResponse } from '../../types'
import { entityKey } from '../query-keys'
import {
  agentResource,
  fetchSnapshot,
  primeSnapshot,
  queueResource,
  snapshotKey,
} from './snapshot'

function emptySnapshot(): SnapshotResponse {
  return { agents: [], queues: [], skills: [], work: [], presenceStatuses: [] }
}

function makeClient(snapshot: SnapshotResponse) {
  const getSnapshot = vi.fn(async () => snapshot)
  const client = { getSnapshot } as unknown as MiradorClient
  return { client, getSnapshot }
}

describe('snapshot resources', () => {
  it('coalesces concurrent cold reads into a single getSnapshot call', async () => {
    const snapshot: SnapshotResponse = {
      ...emptySnapshot(),
      agents: [
        { id: 'a1', name: 'A1' } as SnapshotResponse['agents'][number],
        { id: 'a2', name: 'A2' } as SnapshotResponse['agents'][number],
      ],
    }
    const { client, getSnapshot } = makeClient(snapshot)

    const [a1, a2] = await Promise.all([
      agentResource.fetch(client, 'a1'),
      agentResource.fetch(client, 'a2'),
    ])

    expect(getSnapshot).toHaveBeenCalledTimes(1)
    expect(a1?.id).toBe('a1')
    expect(a2?.id).toBe('a2')
  })

  it('returns null when the id is not in the snapshot', async () => {
    const { client } = makeClient(emptySnapshot())
    await expect(queueResource.fetch(client, 'missing')).resolves.toBeNull()
  })
})

describe('snapshotKey', () => {
  it('defaults to the all scope', () => {
    expect(snapshotKey()).toEqual(['salesforce', 'snapshot', 'all'])
  })

  it('keys each scope distinctly so toggling does not clash', () => {
    expect(snapshotKey('connected')).toEqual([
      'salesforce',
      'snapshot',
      'connected',
    ])
    expect(snapshotKey('connected')).not.toEqual(snapshotKey('all'))
  })
})

describe('fetchSnapshot', () => {
  it('requests the given scope and defaults to all', async () => {
    const { client, getSnapshot } = makeClient(emptySnapshot())
    const queryClient = new QueryClient()

    await fetchSnapshot(client, queryClient, 'connected')
    expect(getSnapshot).toHaveBeenLastCalledWith('connected')

    await fetchSnapshot(client, queryClient)
    expect(getSnapshot).toHaveBeenLastCalledWith('all')
  })
})

describe('primeSnapshot', () => {
  it('seeds every entity list into the cache under its resource key', () => {
    const queryClient = new QueryClient()
    const snapshot: SnapshotResponse = {
      agents: [{ id: 'a1' } as SnapshotResponse['agents'][number]],
      queues: [{ id: 'q1' } as SnapshotResponse['queues'][number]],
      skills: [{ id: 's1' } as SnapshotResponse['skills'][number]],
      work: [{ id: 'w1' } as SnapshotResponse['work'][number]],
      presenceStatuses: [],
    }

    primeSnapshot(queryClient, snapshot)

    expect(
      queryClient.getQueryData(entityKey('salesforce', 'agent', 'a1')),
    ).toEqual({ id: 'a1' })
    expect(
      queryClient.getQueryData(entityKey('salesforce', 'queue', 'q1')),
    ).toEqual({ id: 'q1' })
    expect(
      queryClient.getQueryData(entityKey('salesforce', 'skill', 's1')),
    ).toEqual({ id: 's1' })
    expect(
      queryClient.getQueryData(entityKey('salesforce', 'workItem', 'w1')),
    ).toEqual({ id: 'w1' })
  })

  it('primed data is read by a resource fetch without hitting the network', async () => {
    const queryClient = new QueryClient()
    const { getSnapshot } = makeClient(emptySnapshot())
    primeSnapshot(queryClient, {
      ...emptySnapshot(),
      skills: [{ id: 's9' } as SnapshotResponse['skills'][number]],
    })

    const cached = queryClient.getQueryData(
      entityKey('salesforce', 'skill', 's9'),
    )

    expect(cached).toEqual({ id: 's9' })
    // A resource fetch is only the cold-cache fallback; priming means a reader
    // backed by this cache never needs it.
    expect(getSnapshot).not.toHaveBeenCalled()
  })
})
