import type { Agent, PresenceStatusOption } from '../api/types'

/**
 * Shared presence-filter vocabulary for the Home and Agents panels, so both
 * count and filter agents identically.
 *
 * A filter value is one of:
 * - `ALL_FILTER` — the full roster, including offline agents (Agents panel only).
 * - `CONNECTED_FILTER` — everyone with an active Omni-Channel presence.
 * - a real presence status id — a single configured status from the catalog.
 */
export const CONNECTED_FILTER = 'connected'
export const ALL_FILTER = 'all'

export type AgentPresenceFilter = string

export interface PresenceFilterChip {
  id: string
  label: string
  count: number
}

/** Agents connected to Omni-Channel: those carrying any presence status id. */
export function getConnectedAgents(agents: Agent[]): Agent[] {
  return agents.filter((agent) => agent.presenceStatusId !== null)
}

/**
 * One chip descriptor per catalog status, with a live count over the given
 * connected agents. Chips are emitted even at count 0 so the catalog stays
 * fully visible.
 */
export function buildPresenceFilters(
  connectedAgents: Agent[],
  presenceStatuses: PresenceStatusOption[],
): PresenceFilterChip[] {
  const countById = new Map<string, number>()
  for (const agent of connectedAgents) {
    const id = agent.presenceStatusId
    if (id) countById.set(id, (countById.get(id) ?? 0) + 1)
  }
  return presenceStatuses.map((status) => ({
    id: status.id,
    label: status.label,
    count: countById.get(status.id) ?? 0,
  }))
}

/**
 * Filter already-connected agents (Home semantics — offline never appears).
 * `CONNECTED_FILTER`/`ALL_FILTER` pass everyone through; a status id narrows.
 */
export function filterConnected(
  connectedAgents: Agent[],
  filter: AgentPresenceFilter,
): Agent[] {
  if (filter === CONNECTED_FILTER || filter === ALL_FILTER) {
    return connectedAgents
  }
  return connectedAgents.filter((agent) => agent.presenceStatusId === filter)
}

/**
 * Filter the full roster (Agents panel semantics — offline included under
 * `ALL_FILTER`). `CONNECTED_FILTER` drops offline; a status id narrows further.
 */
export function filterRoster(agents: Agent[], filter: AgentPresenceFilter): Agent[] {
  if (filter === ALL_FILTER) {
    return agents
  }
  if (filter === CONNECTED_FILTER) {
    return getConnectedAgents(agents)
  }
  return agents.filter((agent) => agent.presenceStatusId === filter)
}

/** The count a chip/link should show for the currently active filter. */
export function countForFilter(
  connectedAgents: Agent[],
  presenceFilters: PresenceFilterChip[],
  filter: AgentPresenceFilter,
): number {
  if (filter === CONNECTED_FILTER || filter === ALL_FILTER) {
    return connectedAgents.length
  }
  return presenceFilters.find((chip) => chip.id === filter)?.count ?? 0
}
