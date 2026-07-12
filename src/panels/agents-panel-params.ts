import type { AgentPresenceFilter } from '../utils/agent-presence-filter'

/** Params the Agents panel accepts when opened from another panel. */
export interface AgentsPanelParams {
  presenceFilter: AgentPresenceFilter
  /**
   * Bumped by the sender on every push (see addPanelByType), so re-sending the
   * same filter value still triggers adoption. Absent on panels created
   * directly with initial params.
   */
  revision?: number
}

/**
 * Read the presence filter propagated into the Agents panel, tolerating any
 * shape Dockview hands us. Returns null when absent or malformed, so the panel
 * falls back to its own default.
 */
export function parseAgentsPanelParams(params: unknown): AgentsPanelParams | null {
  if (!params || typeof params !== 'object') {
    return null
  }
  const { presenceFilter, revision } = params as Partial<AgentsPanelParams>
  if (typeof presenceFilter !== 'string' || !presenceFilter) {
    return null
  }
  return { presenceFilter, revision: typeof revision === 'number' ? revision : undefined }
}
