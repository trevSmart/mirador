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

  it('marks an open case id as open', async () => {
    const client = createMockMiradorClient()
    const res = await client.getRecordDetails({ ids: ['500000000000OPEN0'] })
    const rec = res.records[0]
    expect(rec.objectApiName).toBe('Case')
    expect(rec.recordStatus).toBe('New')
    expect(rec.recordClosed).toBe(false)
  })

  it('gives a messaging session a real record status', async () => {
    const client = createMockMiradorClient()
    const res = await client.getRecordDetails({ ids: ['0Mw000000000OPEN0'] })
    const rec = res.records[0]
    expect(rec.objectApiName).toBe('MessagingSession')
    expect(rec.recordStatus).toBe('Active')
    expect(rec.recordClosed).toBe(false)
  })

  it('marks a closed messaging session as ended', async () => {
    const client = createMockMiradorClient()
    const res = await client.getRecordDetails({ ids: ['0Mw000000000CLOSE'] })
    const rec = res.records[0]
    expect(rec.objectApiName).toBe('MessagingSession')
    expect(rec.recordStatus).toBe('Ended')
    expect(rec.recordClosed).toBe(true)
  })

  it('leaves a non-status record without status fields', async () => {
    const client = createMockMiradorClient()
    const res = await client.getRecordDetails({ ids: ['001000000000AAAAA'] })
    const rec = res.records[0]
    expect(rec.recordStatus).toBeNull()
    expect(rec.recordClosed).toBeNull()
  })
})
