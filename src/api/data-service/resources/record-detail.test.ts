import { describe, expect, it, vi } from 'vitest'
import type { MiradorClient } from '../../mirador-client'
import type { RecordDetail } from '../../types'
import { recordDetailResource } from './record-detail'

function makeClient(records: RecordDetail[]) {
  const getRecordDetails = vi.fn(async ({ ids }: { ids: string[] }) => ({
    records: records.filter((record) => ids.includes(record.id)),
  }))
  // Only getRecordDetails is exercised by this resource.
  const client = { getRecordDetails } as unknown as MiradorClient
  return { client, getRecordDetails }
}

function detail(id: string): RecordDetail {
  return { id, objectApiName: 'Case', createdDate: null, lastModifiedDate: null }
}

describe('recordDetailResource', () => {
  it('coalesces concurrent ids into a single /records/details call', async () => {
    const { client, getRecordDetails } = makeClient([detail('a'), detail('b')])

    const [a, b] = await Promise.all([
      recordDetailResource.fetch(client, 'a'),
      recordDetailResource.fetch(client, 'b'),
    ])

    expect(getRecordDetails).toHaveBeenCalledTimes(1)
    expect(getRecordDetails).toHaveBeenCalledWith({ ids: ['a', 'b'] })
    expect(a?.id).toBe('a')
    expect(b?.id).toBe('b')
  })

  it('returns null when the record is not found', async () => {
    const { client } = makeClient([])
    await expect(recordDetailResource.fetch(client, 'missing')).resolves.toBeNull()
  })
})
