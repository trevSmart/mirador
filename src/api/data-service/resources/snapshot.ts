import type { QueryClient } from '@tanstack/react-query'
import type { MiradorClient } from '../../mirador-client'
import type {
  Agent,
  AgentScope,
  Queue,
  Skill,
  SnapshotResponse,
  WorkItem,
} from '../../types'
import { primeEntities, pruneEntities } from '../prime'
import { defineResource, type EntityResource } from '../resource'

/**
 * The snapshot is the single bulk source for agents/queues/skills/work. The
 * snapshot query (data-hooks.ts) keeps these primed in the cache, so
 * individual reads normally hit the cache. The per-resource `fetch` below is the
 * cold-cache fallback: it pulls the snapshot once (concurrent fallbacks coalesce
 * into a single call) and extracts the requested record.
 */
const inflightByClient = new WeakMap<MiradorClient, Promise<SnapshotResponse>>()

function loadSnapshot(client: MiradorClient): Promise<SnapshotResponse> {
  const existing = inflightByClient.get(client)
  if (existing) {
    return existing
  }
  const promise = client.getSnapshot('all')
  inflightByClient.set(client, promise)
  const clear = () => inflightByClient.delete(client)
  // `then(clear, clear)` (not `finally`) so the cleanup chain never produces an
  // unhandled rejection — callers await `promise` directly.
  promise.then(clear, clear)
  return promise
}

// Snapshot entities share the global default freshness window.
const STALE_TIME = 30_000

export const agentResource = defineResource<'salesforce', string, Agent | null>({
  source: 'salesforce',
  entity: 'agent',
  staleTime: STALE_TIME,
  keyOf: (id) => id,
  fetch: async (client, id) => {
    const snapshot = await loadSnapshot(client)
    return snapshot.agents.find((agent) => agent.id === id) ?? null
  },
})

export const queueResource = defineResource<'salesforce', string, Queue | null>({
  source: 'salesforce',
  entity: 'queue',
  staleTime: STALE_TIME,
  keyOf: (id) => id,
  fetch: async (client, id) => {
    const snapshot = await loadSnapshot(client)
    return snapshot.queues.find((queue) => queue.id === id) ?? null
  },
})

export const skillResource = defineResource<'salesforce', string, Skill | null>({
  source: 'salesforce',
  entity: 'skill',
  staleTime: STALE_TIME,
  keyOf: (id) => id,
  fetch: async (client, id) => {
    const snapshot = await loadSnapshot(client)
    return snapshot.skills.find((skill) => skill.id === id) ?? null
  },
})

export const workItemResource = defineResource<
  'salesforce',
  string,
  WorkItem | null
>({
  source: 'salesforce',
  entity: 'workItem',
  staleTime: STALE_TIME,
  keyOf: (id) => id,
  fetch: async (client, id) => {
    const snapshot = await loadSnapshot(client)
    return snapshot.work.find((item) => item.id === id) ?? null
  },
})

/**
 * Query key for the bulk snapshot (the live agents/queues/skills/work feed).
 * Scoped so toggling the agent scope (e.g. show/hide offline reps) is a distinct
 * cached query rather than overwriting the other scope's data.
 */
export const snapshotKey = (scope: AgentScope = 'all') =>
  [...snapshotPrefix(), scope] as const

/**
 * Prefix matching the snapshot query of *every* scope. What you want to
 * invalidate after a mutation: the user may have data cached under more than one
 * scope, and all of it is now stale.
 */
export const snapshotPrefix = () => ['salesforce', 'snapshot'] as const

/**
 * Fetches the snapshot and hydrates the per-entity cache in one go. Used as the
 * `queryFn` of the snapshot query (see data-hooks.ts), so every poll both
 * refreshes the collections and re-primes the per-id entity caches.
 */
export async function fetchSnapshot(
  client: MiradorClient,
  queryClient: QueryClient,
  scope: AgentScope = 'all',
): Promise<SnapshotResponse> {
  const snapshot = await client.getSnapshot(scope)
  primeSnapshot(queryClient, snapshot)
  return snapshot
}

/**
 * Seeds the cache with every entity in a freshly fetched snapshot so later
 * `useEntity(agentResource, id)` reads resolve from cache without a fetch.
 *
 * The per-id cache is a projection of the latest snapshot, so this syncs in both
 * directions: records in the snapshot are primed, and cached records that are no
 * longer in it resolve to `null`. Without the second half, a detail view reading
 * through `useEntity` would keep showing an agent that has gone offline (or a
 * work item that has been closed) — where the collection hooks, which just `find`
 * over the live list, correctly show "not found".
 */
export function primeSnapshot(
  queryClient: QueryClient,
  snapshot: SnapshotResponse,
): void {
  syncEntities(queryClient, agentResource, snapshot.agents)
  syncEntities(queryClient, queueResource, snapshot.queues)
  syncEntities(queryClient, skillResource, snapshot.skills)
  syncEntities(queryClient, workItemResource, snapshot.work)
}

/** Primes every record of one collection and nulls out the ones that vanished. */
function syncEntities<TData extends { id: string }>(
  queryClient: QueryClient,
  resource: EntityResource<'salesforce', string, TData | null>,
  items: TData[],
): void {
  primeEntities(
    queryClient,
    resource,
    items.map((data) => ({ params: data.id, data })),
  )
  pruneEntities(
    queryClient,
    resource,
    items.map((data) => data.id),
  )
}
