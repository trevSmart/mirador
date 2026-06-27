import { describe, expect, it, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MiradorApiContext } from '../mirador-api-context'
import type { MiradorClient } from '../mirador-client'
import type { RecordDetail } from '../types'
import { makeQueryClient } from './query-client'
import { primeEntities } from './prime'
import { recordDetailResource } from './resources/record-detail'
import { useEntity } from './use-entity'

function detail(id: string): RecordDetail {
  return { id, objectApiName: 'Case', createdDate: null, lastModifiedDate: null }
}

function makeClient(records: RecordDetail[]) {
  const getRecordDetails = vi.fn(async ({ ids }: { ids: string[] }) => ({
    records: records.filter((record) => ids.includes(record.id)),
  }))
  const client = { getRecordDetails } as unknown as MiradorClient
  return { client, getRecordDetails }
}

function makeWrapper(client: MiradorClient) {
  const queryClient = makeQueryClient()
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MiradorApiContext.Provider value={client}>
          {children}
        </MiradorApiContext.Provider>
      </QueryClientProvider>
    )
  }
  return { queryClient, Wrapper }
}

describe('useEntity', () => {
  it('shares one fetch across consumers reading the same id', async () => {
    const { client, getRecordDetails } = makeClient([detail('rec-1')])
    const { Wrapper } = makeWrapper(client)

    const { result } = renderHook(
      () => ({
        a: useEntity(recordDetailResource, 'rec-1'),
        b: useEntity(recordDetailResource, 'rec-1'),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.a.isSuccess).toBe(true))

    expect(getRecordDetails).toHaveBeenCalledTimes(1)
    expect(result.current.a.data?.id).toBe('rec-1')
    expect(result.current.b.data?.id).toBe('rec-1')
  })

  it('stays disabled (no fetch) when params is null', () => {
    const { client, getRecordDetails } = makeClient([])
    const { Wrapper } = makeWrapper(client)

    const { result } = renderHook(() => useEntity(recordDetailResource, null), {
      wrapper: Wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getRecordDetails).not.toHaveBeenCalled()
  })

  it('reads primed data from the cache without fetching', async () => {
    const { client, getRecordDetails } = makeClient([])
    const { Wrapper, queryClient } = makeWrapper(client)

    primeEntities(queryClient, recordDetailResource, [
      { params: 'rec-9', data: detail('rec-9') },
    ])

    const { result } = renderHook(
      () => useEntity(recordDetailResource, 'rec-9'),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.id).toBe('rec-9')
    expect(getRecordDetails).not.toHaveBeenCalled()
  })
})
