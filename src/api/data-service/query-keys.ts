import type { SourceId } from './sources'

/**
 * Single place where TanStack Query keys are built. Every key is namespaced as
 * `[source, entity, params]` so the cache scales across external apps (source),
 * entity types (entity) and individual records (params).
 */
export function entityKey(source: SourceId, entity: string, params: unknown) {
  return [source, entity, params] as const
}

/**
 * Prefix key for a whole entity type within a source. Useful for bulk cache
 * invalidation (`invalidateQueries({ queryKey: entityListKey(...) })`).
 */
export function entityListKey(source: SourceId, entity: string) {
  return [source, entity] as const
}
