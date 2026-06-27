import { useAgents, useDataStatus } from '../api/data-hooks'
import { AgentCard } from '../components/AgentCard'
import { FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { countAgentsByStatus, sortAgentsByPresence } from '../utils/agent-stats'

export function AgentsPanel() {
  const agents = useAgents()
  const { isLoading, error, refresh } = useDataStatus()
  const sortedAgents = sortAgentsByPresence(agents)
  const statusCounts = countAgentsByStatus(agents)

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

      <div className="agents-grid">
        {sortedAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </PanelState>
  )
}
