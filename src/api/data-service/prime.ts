import type { QueryClient } from '@tanstack/react-query'
import { entityKey, entityListKey } from './query-keys'
import type { EntityResource } from './resource'
import type { SourceId } from './sources'

/**
 * Seeds the cache with already-known entities so a later `useEntity` read hits
 * the cache instead of fetching. Used to hydrate the per-id caches from a bulk
 * endpoint — see `primeSnapshot` in ./resources/snapshot.
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

/**
 * Counterpart of `primeEntities` for entities primed from a bulk source: any
 * cached record of this type whose key is no longer in the bulk payload is
 * resolved to `null` (i.e. "not found"), so a `useEntity` reader sees the record
 * disappear instead of serving the last-known copy forever.
 *
 * Deliberately `setQueryData(null)` rather than `removeQueries`: removing an
 * entry makes any mounted observer refetch it, which hits the resource's
 * cold-cache fallback (a full snapshot with scope `all`). For a record that is
 * merely out of the current scope — an offline agent under scope `connected` —
 * that fallback finds it again and the next prune drops it again, refetching on
 * every poll. Writing `null` ends the cycle without a request.
 */
export function pruneEntities<S extends SourceId, TParams, TData>(
  queryClient: QueryClient,
  resource: EntityResource<S, TParams, TData | null>,
  keep: Iterable<TParams>,
): void {
  // Normalitzem amb el mateix `keyOf` que va construir les claus cachejades: si
  // comparéssim els params crus, la poda només seria correcta per als resources
  // amb un `keyOf` identitat, i esborraria entrades vàlides per a la resta.
  const kept = new Set<string>()
  for (const params of keep) {
    kept.add(resource.keyOf(params))
  }

  const cached = queryClient
    .getQueryCache()
    .findAll({ queryKey: entityListKey(resource.source, resource.entity) })

  for (const query of cached) {
    const key = query.queryKey[2]
    if (typeof key === 'string' && !kept.has(key) && query.state.data !== null) {
      queryClient.setQueryData<TData | null>(query.queryKey, null)
    }
  }
}
