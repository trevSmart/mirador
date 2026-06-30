import { describe, expect, it } from 'vitest'
import {
  MOCK_AGENT,
  MOCK_PRESENCE,
  MOCK_QUEUE,
  MOCK_SKILL,
  MOCK_SKILL_TYPE,
  mockSfId,
  mockWorkItemId,
} from './mock-ids'

const SF_ID = /^[a-zA-Z0-9]{18}$/

describe('mock-ids', () => {
  it('mockSfId produces 18-char alphanumeric Ids', () => {
    expect(mockSfId('005', 42)).toMatch(SF_ID)
    expect(mockSfId('005', 42)).toBe('005mock00000042AAA')
  })

  it('domain maps use Salesforce key prefixes and 18-char Ids', () => {
    for (const id of Object.values(MOCK_QUEUE)) {
      expect(id).toMatch(SF_ID)
      expect(id.startsWith('00G')).toBe(true)
    }
    for (const id of Object.values(MOCK_SKILL)) {
      expect(id).toMatch(SF_ID)
      expect(id.startsWith('0C5')).toBe(true)
    }
    for (const id of Object.values(MOCK_AGENT)) {
      expect(id).toMatch(SF_ID)
      expect(id.startsWith('005')).toBe(true)
    }
    for (const id of Object.values(MOCK_SKILL_TYPE)) {
      expect(id).toMatch(SF_ID)
      expect(id.startsWith('0C1')).toBe(true)
    }
    for (const id of Object.values(MOCK_PRESENCE)) {
      expect(id).toMatch(SF_ID)
      expect(id.startsWith('0N5')).toBe(true)
    }
    expect(mockWorkItemId(1)).toMatch(SF_ID)
    expect(mockWorkItemId(1).startsWith('0Bz')).toBe(true)
  })
})
