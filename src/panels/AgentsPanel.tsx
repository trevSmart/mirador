import type { IDockviewPanelProps } from 'dockview-react'
import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { AgentRow } from '../components/AgentRow'
import { PanelState } from '../components/PanelState'
import { countAgentsByStatus, sortAgentsByPresence } from '../utils/agent-stats'

export function AgentsPanel({ api }: IDockviewPanelProps) {
  const { agents } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
  const sortedAgents = sortAgentsByPresence(agents)
  const statusCounts = countAgentsByStatus(agents)

  return (
    <PanelState
      panelType="agents"
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0}
      emptyMessage="No hi ha agents Omni disponibles."
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
