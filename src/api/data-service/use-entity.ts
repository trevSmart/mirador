import { useQueries, useQuery } from '@tanstack/react-query'
import { entityKey } from './query-keys'
import type { EntityResource } from './resource'
import { useSourceClient, type SourceClientMap, type SourceId } from './sources'

/**
 * Reads a single entity through the Data Service cache. Sharing the same
 * (source, entity, params) key across the app means the fetch runs once and
 * every consumer reuses the cached result — reopening the same detail twice
 * does not refetch (within `staleTime`).
 *
 * Pass `null`/`undefined` params to keep the query disabled (e.g. nothing
 * selected yet).
 */
export function useEntity<S extends SourceId, TParams, TData>(
  resource: EntityResource<S, TParams, TData>,
  params: TParams | null | undefined,
) {
  const client = useSourceClient(resource.source)
  const hasParams = params !== null && params !== undefined
  const enabled = client !== null && hasParams
  const keyPart = hasParams ? resource.keyOf(params) : null

  return useQuery({
    queryKey: entityKey(resource.source, resource.entity, keyPart),
    queryFn: () =>
      resource.fetch(client as SourceClientMap[S], params as TParams),
    enabled,
    staleTime: resource.staleTime,
  })
}

/**
 * Reads many entities of the same type. Each id is an independent cache entry,
 * so already-cached ids are reused; resources backed by a batch loader collapse
 * the uncached ids into a single network call.
 */
export function useEntities<S extends SourceId, TParams, TData>(
  resource: EntityResource<S, TParams, TData>,
  paramsList: TParams[],
) {
  const client = useSourceClient(resource.source)

  return useQueries({
    queries: paramsList.map((params) => ({
      queryKey: entityKey(resource.source, resource.entity, resource.keyOf(params)),
      queryFn: () =>
        resource.fetch(client as SourceClientMap[S], params),
      enabled: client !== null,
      staleTime: resource.staleTime,
    })),
  })
}
