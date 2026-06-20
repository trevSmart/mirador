import type { IDockviewPanelProps } from 'dockview'
import { useMiradorData } from '../api/MiradorDataProvider'
import { AgentRow } from '../components/AgentRow'
import { PanelState } from '../components/PanelState'
import { countAgentsByStatus, sortAgentsByPresence } from '../utils/agent-stats'

export function AgentsPanel({ api }: IDockviewPanelProps) {
  const { agents, isLoading, error, refresh } = useMiradorData()
  const sortedAgents = sortAgentsByPresence(agents)
  const statusCounts = countAgentsByStatus(agents)

  return (
    <PanelState
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0}
      emptyMessage="No hi ha agents Omni disponibles."
      actions={
        <button
          type="button"
          className="panel-shell__action"
          onClick={() => void refresh()}
          disabled={isLoading}
        >
          Actualitza
        </button>
      }
    >
      <p className="panel-summary">
        {agents.length} agents · {statusCounts.online} en línia · {statusCounts.busy} ocupats ·{' '}
        {statusCounts.away} absents · {statusCounts.offline} fora de línia
      </p>

      <div className="entity-list">
        {sortedAgents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} showSkills />
        ))}
      </div>
    </PanelState>
  )
}
