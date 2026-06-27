import { describe, expect, it, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import {
  PreferencesContext,
  type PreferencesContextValue,
} from '../settings/preferences-context'
import { entityKey, makeQueryClient } from './data-service'
import { useAgents, useDataStatus, useQueues } from './data-hooks'
import { MiradorApiContext } from './mirador-api-context'
import type { MiradorClient } from './mirador-client'
import type { SnapshotResponse } from './types'

function snapshot(): SnapshotResponse {
  return {
    agents: [{ id: 'a1' } as unknown as SnapshotResponse['agents'][number]],
    queues: [{ id: 'q1' } as unknown as SnapshotResponse['queues'][number]],
    skills: [],
    work: [],
  }
}

function makeClient(snap: SnapshotResponse) {
  const getSnapshot = vi.fn(async () => snap)
  const client = { getSnapshot } as unknown as MiradorClient
  return { client, getSnapshot }
}

function makeWrapper(
  client: MiradorClient,
  opts?: { isAuthenticated?: boolean },
) {
  const queryClient = makeQueryClient()
  const auth = {
    isAuthenticated: opts?.isAuthenticated ?? true,
  } as AuthContextValue
  // autoRefresh off so no background polling timers run during tests.
  const preferences = {
    prefs: { autoRefresh: false, refreshInterval: 15 },
    save: () => {},
  } as unknown as PreferencesContextValue

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <PreferencesContext.Provider value={preferences}>
            <MiradorApiContext.Provider value={client}>
              {children}
            </MiradorApiContext.Provider>
          </PreferencesContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }
  return { queryClient, Wrapper }
}

describe('snapshot data hooks', () => {
  it('exposes snapshot collections from a single shared fetch', async () => {
    const { client, getSnapshot } = makeClient(snapshot())
    const { Wrapper } = makeWrapper(client)

    const { result } = renderHook(
      () => ({ agents: useAgents(), queues: useQueues() }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.agents.length).toBe(1))
    expect(result.current.agents[0].id).toBe('a1')
    expect(result.current.queues[0].id).toBe('q1')
    // Both hooks observe the same query → one network call.
    expect(getSnapshot).toHaveBeenCalledTimes(1)
  })

  it('does not fetch when unauthenticated', () => {
    const { client, getSnapshot } = makeClient(snapshot())
    const { Wrapper } = makeWrapper(client, { isAuthenticated: false })

    const { result } = renderHook(() => useAgents(), { wrapper: Wrapper })

    expect(result.current).toEqual([])
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('hydrates the per-entity cache as a side effect of loading', async () => {
    const { client } = makeClient(snapshot())
    const { Wrapper, queryClient } = makeWrapper(client)

    const { result } = renderHook(() => useAgents(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.length).toBe(1))
    expect(
      queryClient.getQueryData(entityKey('salesforce', 'agent', 'a1')),
    ).toEqual({ id: 'a1' })
  })
})

describe('useDataStatus', () => {
  it('reports load status and refreshes on demand', async () => {
    const { client, getSnapshot } = makeClient(snapshot())
    const { Wrapper } = makeWrapper(client)

    const { result } = renderHook(() => useDataStatus(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(getSnapshot).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2))
  })
})
