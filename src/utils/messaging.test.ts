import { describe, expect, it } from 'vitest'
import {
  formatMessagingTime,
  isLiveMessagingSession,
  isMessagingSession,
  senderLabel,
} from './messaging'

describe('isMessagingSession', () => {
  it('detects MessagingSession by objectApiName', () => {
    expect(isMessagingSession({ objectApiName: 'MessagingSession', workItemId: 'x' })).toBe(true)
  })

  it('detects MessagingSession by workItemId prefix', () => {
    expect(isMessagingSession({ objectApiName: null, workItemId: '0Mw000000000001' })).toBe(true)
  })

  it('rejects non-messaging work items', () => {
    expect(isMessagingSession({ objectApiName: 'Case', workItemId: '500000000000001' })).toBe(false)
  })
})

describe('isLiveMessagingSession', () => {
  it('treats terminal statuses as not live', () => {
    expect(isLiveMessagingSession('Ended')).toBe(false)
    expect(isLiveMessagingSession('Inactive')).toBe(false)
    expect(isLiveMessagingSession('Error')).toBe(false)
  })

  it('treats active statuses as live', () => {
    expect(isLiveMessagingSession('Active')).toBe(true)
    expect(isLiveMessagingSession('New')).toBe(true)
  })

  it('falls back to recordStatus', () => {
    expect(isLiveMessagingSession(null, 'Active')).toBe(true)
    expect(isLiveMessagingSession(null, 'Ended')).toBe(false)
  })
})

describe('senderLabel', () => {
  it('labels end users and agents', () => {
    expect(
      senderLabel(
        { senderRole: 'EndUser', senderSubject: 'guest-key' },
        { endUserName: 'Guest' },
      ),
    ).toBe('Guest')

    const agents = new Map([['005AAA', 'Pablo']])
    expect(
      senderLabel(
        { senderRole: 'Agent', senderSubject: '005AAA' },
        { agentNameById: agents },
      ),
    ).toBe('Pablo')
  })
})

describe('formatMessagingTime', () => {
  it('formats epoch milliseconds', () => {
    const formatted = formatMessagingTime(Date.UTC(2026, 0, 15, 10, 30))
    expect(formatted).toMatch(/\d/)
  })
})
