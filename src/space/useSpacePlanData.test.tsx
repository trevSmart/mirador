import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import { MiradorApiContext } from '../api/mirador-api-context'
import type { MiradorClient } from '../api/mirador-client'
import { loadSpacePlan, subscribeSpacePlan } from './space-plan-repository'
import type { SpacePlanData } from './types'
import { useSpacePlanData } from './useSpacePlanData'

vi.mock('./space-plan-repository', () => ({
  loadSpacePlan: vi.fn(),
  subscribeSpacePlan: vi.fn(() => () => {}),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function Wrapper({ children }: { children: ReactNode }) {
  const auth = { isMockMode: false } as AuthContextValue
  const client = {} as MiradorClient
  return (
    <AuthContext.Provider value={auth}>
      <MiradorApiContext.Provider value={client}>{children}</MiradorApiContext.Provider>
    </AuthContext.Provider>
  )
}

describe('useSpacePlanData', () => {
  beforeEach(() => {
    vi.mocked(loadSpacePlan).mockReset()
    vi.mocked(subscribeSpacePlan).mockReset().mockReturnValue(() => {})
  })

  it('keeps the latest load when an older response resolves last', async () => {
    const first = deferred<SpacePlanData | null>()
    const second = deferred<SpacePlanData | null>()
    vi.mocked(loadSpacePlan)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    let notify: (() => void) | undefined
    vi.mocked(subscribeSpacePlan).mockImplementation((listener) => {
      notify = listener
      return () => {}
    })

    const { result } = renderHook(() => useSpacePlanData(), { wrapper: Wrapper })
    expect(loadSpacePlan).toHaveBeenCalledTimes(1)

    // A save notification lands while the initial load is still in flight.
    act(() => notify!())
    expect(loadSpacePlan).toHaveBeenCalledTimes(2)

    const stale = { version: 'stale' } as unknown as SpacePlanData
    const fresh = { version: 'fresh' } as unknown as SpacePlanData

    // Newest request resolves first…
    await act(async () => second.resolve(fresh))
    expect(result.current.data).toBe(fresh)

    // …then the older one arrives late and must be discarded.
    await act(async () => first.resolve(stale))
    expect(result.current.data).toBe(fresh)
    expect(result.current.loaded).toBe(true)
  })
})
