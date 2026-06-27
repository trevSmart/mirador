import { useDataStatus, useQueues } from '../api/data-hooks'
import { FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { sortQueuesByBacklog, totalQueueBacklog } from '../utils/agent-stats'

export function QueuesPanel() {
  const queues = useQueues()
  const { isLoading, error, refresh } = useDataStatus()
  const sortedQueues = sortQueuesByBacklog(queues)

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={queues.length === 0}
      emptyMessage="No hi ha cues configurades."
    >
      <p className="panel-summary">
        <FadeValue value={queues.length} /> cues · <FadeValue value={totalQueueBacklog(queues)} /> treballs en cua
      </p>

      <div className="entity-list entity-list--grid">
        {sortedQueues.map((queue) => (
          <QueueRow key={queue.id} queue={queue} />
        ))}
      </div>
    </PanelState>
  )
}
