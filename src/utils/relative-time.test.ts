import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relative-time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

describe('formatRelativeTime', () => {
  it('shows seconds below one minute', () => {
    expect(formatRelativeTime(0, 5 * SECOND)).toBe('fa 5 s')
  })

  it('shows seconds at the upper second boundary (59 s)', () => {
    expect(formatRelativeTime(0, 59 * SECOND)).toBe('fa 59 s')
  })

  it('switches to minutes at exactly 60 s', () => {
    expect(formatRelativeTime(0, 60 * SECOND)).toBe('fa 1 min')
  })

  it('shows minutes below one hour', () => {
    expect(formatRelativeTime(0, 2 * MINUTE)).toBe('fa 2 min')
  })

  it('shows minutes at the upper minute boundary (59 min)', () => {
    expect(formatRelativeTime(0, 59 * MINUTE)).toBe('fa 59 min')
  })

  it('switches to hours at exactly 60 min', () => {
    expect(formatRelativeTime(0, 60 * MINUTE)).toBe('fa 1 h')
  })

  it('shows hours beyond one hour', () => {
    expect(formatRelativeTime(0, 3 * HOUR)).toBe('fa 3 h')
  })

  it('floors fractional units', () => {
    expect(formatRelativeTime(0, 5 * SECOND + 800)).toBe('fa 5 s')
  })

  it('clamps a future timestamp to "fa 0 s"', () => {
    expect(formatRelativeTime(10 * SECOND, 0)).toBe('fa 0 s')
  })
})
