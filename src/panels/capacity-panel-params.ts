/** Params the Capacity panel accepts when opened from another panel. */
export interface CapacityPanelParams {
  /** Pre-select / lock this queue for the simulation session. */
  focusQueueId?: string
  /**
   * Bumped by the sender on every push (see addPanelByType), so re-sending the
   * same focus still triggers adoption.
   */
  revision?: number
}

/**
 * Read focus params propagated into the Capacity panel. Returns null when
 * absent or malformed so the panel falls back to unlocked defaults.
 */
export function parseCapacityPanelParams(params: unknown): CapacityPanelParams | null {
  if (!params || typeof params !== 'object') return null
  const { focusQueueId, revision } = params as Partial<CapacityPanelParams>
  if (typeof focusQueueId !== 'string' || !focusQueueId) {
    if (typeof revision === 'number') return { revision }
    return null
  }
  return {
    focusQueueId,
    revision: typeof revision === 'number' ? revision : undefined,
  }
}
