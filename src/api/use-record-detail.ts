import { useEffect, useState } from 'react'
import { useMiradorApi } from './mirador-api-context'
import { MiradorApiError, type MiradorClient } from './mirador-client'
import type { RecordDetail } from './types'

export interface RecordDetailState {
  detail: RecordDetail | null
  isLoading: boolean
  error: string | null
}

const EMPTY: RecordDetailState = { detail: null, isLoading: false, error: null }
const LOADING: RecordDetailState = { detail: null, isLoading: true, error: null }

/**
 * Loads the Salesforce record detail for a single id (the work item's backing
 * record). Reuses the batch /records/details endpoint with a one-element list.
 * Cancels in-flight updates when the id changes or the component unmounts.
 */
export function useRecordDetail(recordId: string | null | undefined): RecordDetailState {
  const client = useMiradorApi()
  const canLoad = Boolean(recordId && client)

  const [state, setState] = useState<RecordDetailState>(canLoad ? LOADING : EMPTY)

  // Reset derived state during render when the request key changes, so we don't
  // flash stale data while the effect re-fetches (React's recommended pattern;
  // avoids a synchronous setState inside the effect).
  const requestKey = canLoad ? `${recordId}` : null
  const [prevKey, setPrevKey] = useState<string | null>(requestKey)
  if (requestKey !== prevKey) {
    setPrevKey(requestKey)
    setState(canLoad ? LOADING : EMPTY)
  }

  useEffect(() => {
    if (!recordId || !client) {
      return
    }

    let cancelled = false
    loadRecordDetail(client, recordId).then((next) => {
      if (!cancelled) {
        setState(next)
      }
    })

    return () => {
      cancelled = true
    }
  }, [recordId, client])

  return state
}

async function loadRecordDetail(
  client: MiradorClient,
  recordId: string,
): Promise<RecordDetailState> {
  try {
    const response = await client.getRecordDetails({ ids: [recordId] })
    return { detail: response.records[0] ?? null, isLoading: false, error: null }
  } catch (err: unknown) {
    const message =
      err instanceof MiradorApiError
        ? err.message
        : 'No s\'han pogut carregar els detalls del registre'
    return { detail: null, isLoading: false, error: message }
  }
}
