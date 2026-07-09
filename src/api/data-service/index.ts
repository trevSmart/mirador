/**
 * Data Service layer — the single seam between the integration layer (clients)
 * and the UI. Provides caching + request deduplication on top of TanStack Query,
 * organized along three axes: source (external app) → entity (type) → params.
 *
 * Usage (once a consumer is migrated):
 *   const { data, isLoading } = useEntity(recordDetailResource, recordId)
 */
export { DataServiceProvider } from './DataServiceProvider'
export { makeQueryClient } from './query-client'
export { useEntity, useEntities } from './use-entity'
export { primeEntities } from './prime'
export { defineResource, type EntityResource } from './resource'
export { entityKey, entityListKey } from './query-keys'
export { createBatchLoader } from './batch-loader'
export { useSourceClient, type SourceId, type SourceClientMap } from './sources'
export { recordDetailResource } from './resources/record-detail'
export {
  agentTimelineResource,
  type AgentTimelineParams,
} from './resources/agent-timeline'
export {
  agentResource,
  queueResource,
  skillResource,
  workItemResource,
  primeSnapshot,
  fetchSnapshot,
  snapshotKey,
} from './resources/snapshot'
