import type { IDockviewPanelProps } from 'dockview'
import { useMiradorData } from '../api/MiradorDataProvider'
import { AgentRow } from '../components/AgentRow'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import {
  countAgentsByStatus,
  sortAgentsByPresence,
  sortQueuesByBacklog,
  totalAgentWork,
  totalQueueBacklog,
} from '../utils/agent-stats'

export function HomePanel({ api }: IDockviewPanelProps) {
  const { agents, queues, isLoading, error, refresh } = useMiradorData()
  const statusCounts = countAgentsByStatus(agents)
  const topQueues = sortQueuesByBacklog(queues).slice(0, 5)
  const activeAgents = sortAgentsByPresence(agents).slice(0, 5)

  return (
    <PanelState
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0 && queues.length === 0}
      emptyMessage="No hi ha agents ni cues disponibles."
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
      <div className="summary-grid">
        <section className="summary-card">
          <p className="summary-card__label">Agents</p>
          <p className="summary-card__value">{agents.length}</p>
          <p className="summary-card__detail">
            {statusCounts.online} en línia · {statusCounts.busy} ocupats ·{' '}
            {statusCounts.away} absents · {statusCounts.offline} fora de línia
          </p>
        </section>

        <section className="summary-card">
          <p className="summary-card__label">Treball actiu</p>
          <p className="summary-card__value">{totalAgentWork(agents)}</p>
          <p className="summary-card__detail">Casos assignats als agents</p>
        </section>

        <section className="summary-card">
          <p className="summary-card__label">Cues</p>
          <p className="summary-card__value">{queues.length}</p>
          <p className="summary-card__detail">{totalQueueBacklog(queues)} treballs en cua</p>
        </section>
      </div>

      <div className="panel-columns">
        <section className="panel-section">
          <h3 className="panel-section__title">Cues amb més backlog</h3>
          {topQueues.length > 0 ? (
            <div className="entity-list">
              {topQueues.map((queue) => (
                <QueueRow key={queue.id} queue={queue} />
              ))}
            </div>
          ) : (
            <p className="panel-section__empty">Cap cua amb treball pendent.</p>
          )}
        </section>

        <section className="panel-section">
          <h3 className="panel-section__title">Agents actius</h3>
          {activeAgents.length > 0 ? (
            <div className="entity-list">
              {activeAgents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <p className="panel-section__empty">Cap agent connectat ara mateix.</p>
          )}
        </section>
      </div>
    </PanelState>
  )
}
