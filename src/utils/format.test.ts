import { describe, expect, it } from 'vitest'
import { recordStatusLabel, recordStatusTone } from './format'

describe('recordStatusLabel', () => {
  it('returns null when no status', () => {
    expect(recordStatusLabel({ recordStatus: null, recordClosed: null })).toBeNull()
  })
  it('labels a closed case', () => {
    expect(recordStatusLabel({ recordStatus: 'Closed', recordClosed: true })).toBe('Tancat')
  })
  it('falls back to raw status when open', () => {
    expect(recordStatusLabel({ recordStatus: 'New', recordClosed: false })).toBe('New')
  })
  it('tone is neutral when closed, ok when open', () => {
    expect(recordStatusTone({ recordStatus: 'Closed', recordClosed: true })).toBe('neutral')
    expect(recordStatusTone({ recordStatus: 'New', recordClosed: false })).toBe('ok')
  })
})
