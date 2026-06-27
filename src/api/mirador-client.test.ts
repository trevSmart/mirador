import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMiradorClient } from './mirador-client'
import { devLog } from '../dev/dev-log'

const originalFetch = globalThis.fetch

const session = {
  instanceUrl: 'https://example.my.salesforce.com',
  accessToken: 'token',
} as never

function mockFetch(impl: () => unknown) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

describe('createMiradorClient dev-log error reporting', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    devLog.clear()
  })

  it('records an error-level entry when a request returns a non-ok status', async () => {
    mockFetch(() => ({
      ok: false,
      status: 405,
      text: async () => 'Method Not Allowed',
    }))
    const client = createMiradorClient(() => session)

    await expect(client.getRecordDetails({ ids: ['a'] })).rejects.toThrow()

    const errors = devLog.getEntries().filter((e) => e.level === 'error')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.text.includes('405'))).toBe(true)
    expect(errors.some((e) => e.text.includes('/records/details'))).toBe(true)
  })

  it('records an error-level entry when the request fails at the network layer', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const client = createMiradorClient(() => session)

    await expect(client.getSnapshot()).rejects.toThrow()

    const errors = devLog.getEntries().filter((e) => e.level === 'error')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.text.includes('/snapshot'))).toBe(true)
  })
})
