import type { SourceClientMap, SourceId } from './sources'

/**
 * Describes how to fetch one entity type from one source. New entity types are
 * added by declaring a new resource with `defineResource` — no changes to the
 * hooks or the cache machinery are needed.
 *
 * @typeParam S - source id (which external app / client this entity comes from)
 * @typeParam TParams - the lookup params (e.g. a record id, or a filter object)
 * @typeParam TData - the shape returned for the entity
 */
export interface EntityResource<
  S extends SourceId,
  TParams,
  TData,
> {
  /** Which source (external app) this entity belongs to. */
  source: S
  /** Stable entity name, used in the query key and for invalidation. */
  entity: string
  /** Per-entity override of the cache freshness window (ms). */
  staleTime?: number
  /** Serializes params into a stable string for the query key + batch dedup. */
  keyOf: (params: TParams) => string
  /** Performs the actual fetch using the source's client. */
  fetch: (client: SourceClientMap[S], params: TParams) => Promise<TData>
}

/**
 * Identity helper that pins the generic parameters of a resource so call sites
 * get full inference. Declaring resources through this keeps every descriptor
 * uniform.
 */
export function defineResource<S extends SourceId, TParams, TData>(
  resource: EntityResource<S, TParams, TData>,
): EntityResource<S, TParams, TData> {
  return resource
}
