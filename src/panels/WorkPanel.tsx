import { useMemo } from 'react'
import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { WorkRow } from '../components/WorkRow'
import { countWorkByStatus, partitionWorkByStatus } from '../utils/agent-stats'

export function WorkPanel() {
  const { agents, queues, work } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
  const { assigned, queued } = partitionWorkByStatus(work)
  const statusCounts = countWorkByStatus(work)

  const agentNames = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )
  const queueNames = useMemo(
    () => new Map(queues.map((queue) => [queue.id, queue.name])),
    [queues],
  )

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={work.length === 0}
      emptyMessage="No hi ha treball assignat ni en cua."
    >
      <p className="panel-summary">
        <FadeValue value={work.length} /> treballs · <FadeValue value={statusCounts.assigned} /> assignats ·{' '}
        <FadeValue value={statusCounts.queued} /> en cua
      </p>

      <div className="panel-columns">
        <section className="panel-section">
          <h3 className="panel-section__title">Assignats</h3>
          {assigned.length > 0 ? (
            <div className="entity-list">
              {assigned.map((item) => (
                <WorkRow
                  key={item.id}
                  item={item}
                  agentName={item.agentId ? agentNames.get(item.agentId) : null}
                  queueName={item.queueId ? queueNames.get(item.queueId) : null}
                />
              ))}
            </div>
          ) : (
            <p className="panel-section__empty">Cap treball assignat ara mateix.</p>
          )}
        </section>

        <section className="panel-section">
          <h3 className="panel-section__title">En cua</h3>
          {queued.length > 0 ? (
            <div className="entity-list">
              {queued.map((item) => (
                <WorkRow
                  key={item.id}
                  item={item}
                  queueName={item.queueId ? queueNames.get(item.queueId) : null}
                />
              ))}
            </div>
          ) : (
            <p className="panel-section__empty">Cap treball en cua ara mateix.</p>
          )}
        </section>
      </div>
    </PanelState>
  )
}
