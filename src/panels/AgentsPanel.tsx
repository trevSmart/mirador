import { useMemo, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useAgents, useDataStatus, usePresenceStatuses } from '../api/data-hooks'
import { AgentCard } from '../components/AgentCard'
import { Chip, FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { countAgentsByStatus, sortAgentsByPresence } from '../utils/agent-stats'
import {
  ALL_FILTER,
  CONNECTED_FILTER,
  buildPresenceFilters,
  filterRoster,
  getConnectedAgents,
  type AgentPresenceFilter,
} from '../utils/agent-presence-filter'
import { parseAgentsPanelParams } from './agents-panel-params'

export function AgentsPanel({ params }: IDockviewPanelProps) {
  const agents = useAgents()
  const presenceStatuses = usePresenceStatuses()
  const { isLoading, error, refresh } = useDataStatus()

  // A presence filter can arrive from the Home ("Veure tots"). Default to the
  // full roster when opened directly (via tab / add-panel menu).
  const incoming = parseAgentsPanelParams(params)
  const [filter, setFilter] = useState<AgentPresenceFilter>(
    incoming?.presenceFilter ?? ALL_FILTER,
  )

  // Re-clicking the Home link calls updateParameters, which re-renders us with
  // a new params value — adopt it durant el render (patró convergent) en
  // comptes d'un efecte. Keyed on the revision the sender bumps on every push
  // (not on the filter value): re-sending the same filter after the user
  // changed it locally must still win.
  const [prevRevision, setPrevRevision] = useState(incoming?.revision)
  if (incoming && incoming.revision !== prevRevision) {
    setPrevRevision(incoming.revision)
    setFilter(incoming.presenceFilter)
  }

  const connectedAgents = useMemo(() => getConnectedAgents(agents), [agents])
  const presenceFilters = useMemo(
    () => buildPresenceFilters(connectedAgents, presenceStatuses),
    [connectedAgents, presenceStatuses],
  )

  const statusCounts = countAgentsByStatus(agents)
  const visibleAgents = useMemo(
    () => sortAgentsByPresence(filterRoster(agents, filter)),
    [agents, filter],
  )

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0}
      emptyMessage="No hi ha agents Omni disponibles."
    >
      <p className="panel-summary">
        <FadeValue value={agents.length} /> agents · <FadeValue value={statusCounts.online} /> en línia ·{' '}
        <FadeValue value={statusCounts.busy} /> ocupats · <FadeValue value={statusCounts.away} /> absents ·{' '}
        <FadeValue value={statusCounts.offline} /> desconnectats
      </p>

      <div className="panel-section__filters" role="group" aria-label="Filtra els agents">
        <Chip
          active={filter === ALL_FILTER}
          count={agents.length}
          onClick={() => setFilter(ALL_FILTER)}
        >
          Tots
        </Chip>
        <Chip
          active={filter === CONNECTED_FILTER}
          count={connectedAgents.length}
          onClick={() => setFilter(CONNECTED_FILTER)}
        >
          Connectats
        </Chip>
        {presenceFilters.map((chip) => (
          <Chip
            key={chip.id}
            active={filter === chip.id}
            count={chip.count}
            onClick={() => setFilter(chip.id)}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {visibleAgents.length > 0 ? (
        <div className="agents-grid">
          {visibleAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <p className="panel-section__empty">Cap agent en aquest estat.</p>
      )}
    </PanelState>
  )
}
