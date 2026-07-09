import type { AgentTimeline } from '../../types'
import { defineResource } from '../resource'

export interface AgentTimelineParams {
  agentId: string
  /** ISO date (YYYY-MM-DD). */
  day: string
}

/**
 * Reference resource: one agent's activity for a given day (presence bands +
 * work bars). Cached per (agentId, day) so reopening the same day is instant.
 * Short freshness so the ongoing band/active work stay live under polling.
 */
export const agentTimelineResource = defineResource<
  'salesforce',
  AgentTimelineParams,
  AgentTimeline
>({
  source: 'salesforce',
  entity: 'agentTimeline',
  staleTime: 15_000,
  keyOf: ({ agentId, day }) => `${agentId}:${day}`,
  fetch: async (client, { agentId, day }) => {
    const response = await client.getAgentTimeline(agentId, day)
    return response.timeline
  },
})
