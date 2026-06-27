import type { QueryClient } from '@tanstack/react-query'
import type { MiradorClient } from '../../mirador-client'
import type {
  Agent,
  Queue,
  Skill,
  SnapshotResponse,
  WorkItem,
} from '../../types'
import { primeEntities } from '../prime'
import { defineResource } from '../resource'

/**
 * The snapshot is the single bulk source for agents/queues/skills/work. The
 * polling provider (MiradorDataProvider) keeps these primed in the cache, so
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
 * Seeds the cache with every entity in a freshly fetched snapshot so later
 * `useEntity(agentResource, id)` reads resolve from cache without a fetch. Called
 * by MiradorDataProvider after each successful snapshot load.
 */
export function primeSnapshot(
  queryClient: QueryClient,
  snapshot: SnapshotResponse,
): void {
  primeEntities(
    queryClient,
    agentResource,
    snapshot.agents.map((data) => ({ params: data.id, data })),
  )
  primeEntities(
    queryClient,
    queueResource,
    snapshot.queues.map((data) => ({ params: data.id, data })),
  )
  primeEntities(
    queryClient,
    skillResource,
    snapshot.skills.map((data) => ({ params: data.id, data })),
  )
  primeEntities(
    queryClient,
    workItemResource,
    snapshot.work.map((data) => ({ params: data.id, data })),
  )
}
