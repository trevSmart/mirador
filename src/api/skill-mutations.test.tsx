import { describe, expect, it, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import {
  PreferencesContext,
  type PreferencesContextValue,
} from '../settings/preferences-context'
import { makeQueryClient, snapshotKey } from './data-service'
import { useUpdateAgentSkills } from './skill-mutations'
import { MiradorApiContext } from './mirador-api-context'
import type { MiradorClient } from './mirador-client'
import type { AgentScope, SnapshotResponse } from './types'

function emptySnapshot(): SnapshotResponse {
  return {
    agents: [],
    queues: [],
    skills: [],
    work: [],
    presenceStatuses: [],
  }
}

function makeClient(overrides?: Partial<MiradorClient>) {
  const updateAgentSkills = vi.fn(async () => ({ ok: true }))
  const client = { updateAgentSkills, ...overrides } as unknown as MiradorClient
  return { client, updateAgentSkills }
}

function makeWrapper(
  client: MiradorClient | null,
  opts?: { isAuthenticated?: boolean },
) {
  const queryClient = makeQueryClient()
  const auth = {
    isAuthenticated: opts?.isAuthenticated ?? true,
  } as AuthContextValue
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

describe('useUpdateAgentSkills', () => {
  it('crida updateAgentSkills amb (agentId, { changes })', async () => {
    const { client, updateAgentSkills } = makeClient()
    const { Wrapper } = makeWrapper(client)

    const { result } = renderHook(() => useUpdateAgentSkills(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        agentId: 'a1',
        changes: [{ skillId: 's1', level: 3 }],
      })
    })

    expect(updateAgentSkills).toHaveBeenCalledWith('a1', {
      changes: [{ skillId: 's1', level: 3 }],
    })
  })

  it("en èxit, invalida les queries del snapshot", async () => {
    const { client } = makeClient()
    const { Wrapper, queryClient } = makeWrapper(client)

    // Pre-poblem una query de snapshot perquè puguem observar-ne la invalidació.
    const scope: AgentScope = 'connected'
    queryClient.setQueryData(snapshotKey(scope), emptySnapshot())

    const { result } = renderHook(() => useUpdateAgentSkills(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        agentId: 'a1',
        changes: [{ skillId: 's1', remove: true }],
      })
    })

    await waitFor(() => {
      const state = queryClient.getQueryState(snapshotKey(scope))
      expect(state?.isInvalidated).toBe(true)
    })
  })

  it('si no hi ha client (no autenticat), la mutació falla', async () => {
    const { Wrapper } = makeWrapper(null)

    const { result } = renderHook(() => useUpdateAgentSkills(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ agentId: 'a1', changes: [] }),
      ).rejects.toThrow()
    })
  })
})
