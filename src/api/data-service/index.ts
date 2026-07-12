/**
 * Data Service layer — the single seam between the integration layer (clients)
 * and the UI. Provides caching + request deduplication on top of TanStack Query,
 * organized along three axes: source (external app) → entity (type) → params.
 *
 * Usage:
 *   const { data, isLoading } = useEntity(agentResource, agentId)
 *
 * This barrel is the layer's public surface: what the app outside `data-service/`
 * consumes. The building blocks used to *assemble* the layer (defineResource,
 * createBatchLoader, primeEntities, entityKey…) stay internal — import them from
 * their own modules.
 */
export { DataServiceProvider } from './DataServiceProvider'
export { makeQueryClient } from './query-client'
export { useEntity, useEntities } from './use-entity'
export { entityKey } from './query-keys'
export { useSourceClient } from './sources'
export { recordDetailResource } from './resources/record-detail'
export { agentTimelineResource } from './resources/agent-timeline'
export {
  agentResource,
  queueResource,
  skillResource,
  workItemResource,
  fetchSnapshot,
  snapshotKey,
  snapshotPrefix,
} from './resources/snapshot'
