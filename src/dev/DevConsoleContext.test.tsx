/* DevConsoleProvider ↔ dev-log integration.

   Covers the two delivery hazards:
   - entries pushed between the provider's first render and its subscription
     effect (e.g. devLog.error from a descendant's mount effect) must still
     reach the UI state;
   - a console.error emitted during another component's render must not turn
     into a synchronous setState on the provider (React's "Cannot update a
     component while rendering a different component"). */

/* eslint-disable no-console -- these tests stub/restore the very console
   methods the provider's interceptor wraps */

import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type DevLog = typeof import('./dev-log')['devLog']
type Provider = typeof import('./DevConsoleContext')['DevConsoleProvider']
type UseDevConsole = typeof import('./useDevConsole')['useDevConsole']

/* dev-log keeps module-level state and the provider installs console
   interceptors on mount, so each test gets fresh module instances and
   stubbed console methods (restored afterwards). */

const realConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

let devLog: DevLog
let DevConsoleProvider: Provider
let useDevConsole: UseDevConsole
let errorStub: ReturnType<typeof vi.fn<(...data: unknown[]) => void>>

beforeEach(async () => {
  console.log = vi.fn()
  console.info = vi.fn()
  console.warn = vi.fn()
  errorStub = vi.fn<(...data: unknown[]) => void>()
  console.error = errorStub
  vi.resetModules()
  ;({ devLog } = await import('./dev-log'))
  ;({ DevConsoleProvider } = await import('./DevConsoleContext'))
  ;({ useDevConsole } = await import('./useDevConsole'))
})

afterEach(() => {
  console.log = realConsole.log
  console.info = realConsole.info
  console.warn = realConsole.warn
  console.error = realConsole.error
  localStorage.clear()
})

/* Renders the context entries so tests can observe the provider state. */
function Probe() {
  const { entries } = useDevConsole()
  return <div data-testid="entries">{entries.map((e) => e.text).join('|')}</div>
}

function entryTexts(): string[] {
  const text = screen.getByTestId('entries').textContent ?? ''
  return text === '' ? [] : text.split('|')
}

describe('DevConsoleProvider entry delivery', () => {
  it('delivers entries pushed from a descendant mount effect (before the subscription starts)', async () => {
    function LogsOnMount() {
      useEffect(() => {
        devLog.error('from mount effect')
      }, [])
      return null
    }

    render(
      <DevConsoleProvider>
        <LogsOnMount />
        <Probe />
      </DevConsoleProvider>,
    )

    await waitFor(() => {
      expect(entryTexts()).toContain('from mount effect')
    })
  })

  it('does not duplicate entries seeded at first render whose notification is still pending', async () => {
    devLog.error('pending at mount') // in the buffer; flush not delivered yet

    render(
      <DevConsoleProvider>
        <Probe />
      </DevConsoleProvider>,
    )

    // Let the pending flush and the provider re-sync both run.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

    expect(entryTexts().filter((t) => t === 'pending at mount')).toHaveLength(1)
  })

  it('a console.error during another component render does not setState during render', async () => {
    const { rerender } = render(
      <DevConsoleProvider>
        <Probe />
      </DevConsoleProvider>,
    )
    // Let install() + subscription settle before the offending render.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

    function ShoutsDuringRender() {
      console.error('shout during render')
      return null
    }

    rerender(
      <DevConsoleProvider>
        <Probe />
        <ShoutsDuringRender />
      </DevConsoleProvider>,
    )

    // The entry must still arrive (asynchronously).
    await waitFor(() => {
      expect(entryTexts()).toContain('shout during render')
    })

    // …without React complaining about a cross-component render update.
    const crossRenderWarnings = errorStub.mock.calls.filter(
      (args) =>
        typeof args[0] === 'string' &&
        args[0].includes('Cannot update a component'),
    )
    expect(crossRenderWarnings).toEqual([])
  })
})
