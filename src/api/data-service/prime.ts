import type { QueryClient } from '@tanstack/react-query'
import { entityKey } from './query-keys'
import type { EntityResource } from './resource'
import type { SourceId } from './sources'

/**
 * Seeds the cache with already-known entities so a later `useEntity` read hits
 * the cache instead of fetching. Designed for hydration from a bulk endpoint
 * (e.g. priming record details / agents from the snapshot) — that wiring is a
 * follow-up, this is the primitive it will use.
 */
export function primeEntities<S extends SourceId, TParams, TData>(
  queryClient: QueryClient,
  resource: EntityResource<S, TParams, TData>,
  items: Array<{ params: TParams; data: TData }>,
): void {
  for (const { params, data } of items) {
    queryClient.setQueryData(
      entityKey(resource.source, resource.entity, resource.keyOf(params)),
      data,
    )
  }
}
