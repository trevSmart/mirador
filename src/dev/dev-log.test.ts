/* Contract tests for the dev-log notification pipeline.

   The buffer write must stay synchronous (no entry may be lost), but
   subscriber notification must be deferred and coalesced: a console.* call
   during a React render must never trigger a synchronous subscriber call,
   and a subscriber that logs while being notified must never re-enter the
   pipeline synchronously. */

/* eslint-disable no-console -- these tests stub/restore the very console
   methods the interceptor wraps */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogEntry } from './dev-log'

type DevLog = typeof import('./dev-log')['devLog']

/* dev-log keeps module-level state (buffer, seq, installed flags) and
   install() rewires the global console, so each test gets a fresh module
   instance. Console methods are stubbed before the module is imported (its
   `_orig` refs bind at import time) and restored afterwards so no wrapping
   leaks into other tests. */

const realConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

let devLog: DevLog

beforeEach(async () => {
  console.log = vi.fn()
  console.info = vi.fn()
  console.warn = vi.fn()
  console.error = vi.fn()
  vi.resetModules()
  ;({ devLog } = await import('./dev-log'))
})

afterEach(() => {
  console.log = realConsole.log
  console.info = realConsole.info
  console.warn = realConsole.warn
  console.error = realConsole.error
})

/* Waits for the microtask queue to drain past the flush scheduled by push. */
const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve))

/* Waits past a full macrotask so cascaded microtask flushes settle too. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('devLog notification pipeline', () => {
  it('writes the buffer synchronously but notifies subscribers asynchronously', async () => {
    const received: LogEntry[][] = []
    devLog.subscribe((event) => {
      if (event.type === 'append') received.push(event.entries)
    })

    devLog.error('boom')

    expect(devLog.getEntries().map((e) => e.text)).toEqual(['boom']) // sync
    expect(received).toHaveLength(0) // not notified during push

    await microtask()

    expect(received).toHaveLength(1)
    expect(received[0].map((e) => e.text)).toEqual(['boom'])
  })

  it('coalesces multiple pushes in the same tick into a single notification', async () => {
    devLog.setCapturing(true)
    const received: LogEntry[][] = []
    devLog.subscribe((event) => {
      if (event.type === 'append') received.push(event.entries)
    })

    devLog.action('one')
    devLog.action('two')
    devLog.error('three')

    await microtask()

    expect(received).toHaveLength(1)
    expect(received[0].map((e) => e.text)).toEqual(['one', 'two', 'three'])
  })

  it('a push from inside a notification does not recurse synchronously', async () => {
    const received: string[][] = []
    let reentered = false
    devLog.subscribe((event) => {
      if (event.type !== 'append') return
      received.push(event.entries.map((e) => e.text))
      if (!reentered) {
        reentered = true
        devLog.error('from subscriber')
      }
    })

    devLog.error('original')
    await settle()

    // Two separate flushes, never a nested (synchronous) notification.
    expect(received).toEqual([['original'], ['from subscriber']])
    expect(devLog.getEntries().map((e) => e.text)).toEqual([
      'original',
      'from subscriber',
    ])
  })

  it('console.error during a notification is captured but delivered in a later flush', async () => {
    devLog.install()
    const received: string[][] = []
    let reentered = false
    devLog.subscribe((event) => {
      if (event.type !== 'append') return
      received.push(event.entries.map((e) => e.text))
      if (!reentered) {
        reentered = true
        // Simulates a React dev warning fired while the provider updates.
        console.error('re-entrant warning')
      }
    })

    console.error('first')
    await settle()

    expect(received).toEqual([['first'], ['re-entrant warning']])
  })

  it('clear supersedes pending entries and is delivered deferred, in order', async () => {
    type Seen = { type: 'clear' } | { type: 'append'; texts: string[] }
    const seen: Seen[] = []
    devLog.subscribe((event) => {
      if (event.type === 'clear') seen.push({ type: 'clear' })
      else seen.push({ type: 'append', texts: event.entries.map((e) => e.text) })
    })

    devLog.error('before clear')
    devLog.clear()
    devLog.error('after clear')

    expect(seen).toHaveLength(0) // clear notification is deferred too

    await microtask()

    expect(seen).toEqual([
      { type: 'clear' },
      { type: 'append', texts: ['after clear'] },
    ])
    expect(devLog.getEntries().map((e) => e.text)).toEqual(['after clear'])
  })

  it('entries carry monotonically increasing ids', async () => {
    devLog.error('a')
    devLog.error('b')
    await microtask()

    const [a, b] = devLog.getEntries()
    expect(b.id).toBeGreaterThan(a.id)
  })
})
