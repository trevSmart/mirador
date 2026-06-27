import type { MiradorClient } from '../../mirador-client'
import type { RecordDetail } from '../../types'
import { createBatchLoader } from '../batch-loader'
import { defineResource } from '../resource'

/**
 * One batch loader per client instance. Keyed by client so mock and real
 * clients never share a loader, and so the loader is garbage-collected with the
 * client. Each loader coalesces concurrent record-detail loads into a single
 * POST /records/details call.
 */
const loadersByClient = new WeakMap<
  MiradorClient,
  (id: string) => Promise<RecordDetail | undefined>
>()

function getLoader(client: MiradorClient) {
  let loader = loadersByClient.get(client)
  if (!loader) {
    loader = createBatchLoader<string, RecordDetail>(async (ids) => {
      const response = await client.getRecordDetails({ ids })
      const byId = new Map<string, RecordDetail>()
      for (const record of response.records) {
        byId.set(record.id, record)
      }
      return byId
    })
    loadersByClient.set(client, loader)
  }
  return loader
}

/**
 * Reference resource: the Salesforce record detail behind a work item. Combines
 * TanStack cache/dedup (same id → cached) with batch coalescing (many ids at
 * once → one request). Params is the record id.
 */
export const recordDetailResource = defineResource<
  'salesforce',
  string,
  RecordDetail | null
>({
  source: 'salesforce',
  entity: 'recordDetail',
  staleTime: 5 * 60_000,
  keyOf: (id) => id,
  fetch: async (client, id) => {
    const detail = await getLoader(client)(id)
    return detail ?? null
  },
})
