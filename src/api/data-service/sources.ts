import { useMiradorApi } from '../mirador-api-context'
import type { MiradorClient } from '../mirador-client'

/**
 * Registry of data sources (external apps). Each source maps to the client type
 * used to talk to it. Adding a new external app is a two-step change:
 *   1. Extend this map with the new source id → client type.
 *   2. Add a case in `useSourceClient` that resolves that client from its context.
 *
 * The query-key factory namespaces every entity by source id, so entities from
 * different apps never collide in the cache.
 */
export interface SourceClientMap {
  salesforce: MiradorClient
}

export type SourceId = keyof SourceClientMap

/**
 * Resolves the active client for a given source from React context. Returns null
 * when the client is not ready yet (e.g. not authenticated), which callers use
 * to keep the query disabled.
 */
export function useSourceClient<S extends SourceId>(
  source: S,
): SourceClientMap[S] | null {
  const miradorClient = useMiradorApi()

  switch (source) {
    case 'salesforce':
      return miradorClient as SourceClientMap[S] | null
    default:
      return null
  }
}
