import { describe, expect, it } from 'vitest'
import { createMockMiradorClient } from './mock-client'

describe('mock record details', () => {
  it('marks a closed case id as closed', async () => {
    const client = createMockMiradorClient()
    const res = await client.getRecordDetails({ ids: ['500000000000CLOSE'] })
    const rec = res.records[0]
    expect(rec.objectApiName).toBe('Case')
    expect(rec.recordStatus).toBe('Closed')
    expect(rec.recordClosed).toBe(true)
  })
})
