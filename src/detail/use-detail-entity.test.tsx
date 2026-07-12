import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { entityKey, makeQueryClient } from '../api/data-service'
import { MiradorApiContext } from '../api/mirador-api-context'
import type { MiradorClient } from '../api/mirador-client'
import { useDetailEntity } from './use-detail-entity'

function makeWrapper() {
  const queryClient = makeQueryClient()
  const getSnapshot = vi.fn()
  const client = { getSnapshot } as unknown as MiradorClient

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MiradorApiContext.Provider value={client}>
          {children}
        </MiradorApiContext.Provider>
      </QueryClientProvider>
    )
  }
  return { queryClient, Wrapper, getSnapshot }
}

describe('useDetailEntity', () => {
  it('resol el registre de la caché primada sense cap petició', () => {
    const { queryClient, Wrapper, getSnapshot } = makeWrapper()
    queryClient.setQueryData(entityKey('salesforce', 'agent', 'a1'), {
      id: 'a1',
      name: 'Marta',
    })

    const { result } = renderHook(
      () => useDetailEntity({ kind: 'agent', id: 'a1' }),
      { wrapper: Wrapper },
    )

    expect(result.current.entity).toEqual({
      kind: 'agent',
      data: { id: 'a1', name: 'Marta' },
    })
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('només consulta el tipus del target: els altres tres queden inactius', () => {
    const { queryClient, Wrapper } = makeWrapper()
    // Mateixa id sota un altre tipus: si el hook no discriminés per kind,
    // retornaria aquest registre.
    queryClient.setQueryData(entityKey('salesforce', 'skill', 'x1'), {
      id: 'x1',
      name: 'Facturació',
    })

    const { result } = renderHook(
      () => useDetailEntity({ kind: 'queue', id: 'x1' }),
      { wrapper: Wrapper },
    )

    expect(result.current.entity).toBeNull()
  })

  it('sense target no resol res ni carrega', () => {
    const { Wrapper, getSnapshot } = makeWrapper()

    const { result } = renderHook(() => useDetailEntity(null), {
      wrapper: Wrapper,
    })

    expect(result.current.entity).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('un registre podat del snapshot (null a la caché) es llegeix com a no trobat', () => {
    const { queryClient, Wrapper } = makeWrapper()
    queryClient.setQueryData(entityKey('salesforce', 'workItem', 'w1'), null)

    const { result } = renderHook(
      () => useDetailEntity({ kind: 'work', id: 'w1' }),
      { wrapper: Wrapper },
    )

    expect(result.current.entity).toBeNull()
  })

  it('resol un work item, que es guarda sota l\'entitat workItem', () => {
    const { queryClient, Wrapper } = makeWrapper()
    queryClient.setQueryData(entityKey('salesforce', 'workItem', 'w1'), {
      id: 'w1',
      subject: 'Factura duplicada',
    })

    const { result } = renderHook(
      () => useDetailEntity({ kind: 'work', id: 'w1' }),
      { wrapper: Wrapper },
    )

    expect(result.current.entity).toEqual({
      kind: 'work',
      data: { id: 'w1', subject: 'Factura duplicada' },
    })
  })
})
