import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { sortQueuesByBacklog, totalQueueBacklog } from '../utils/agent-stats'

export function QueuesPanel() {
  const { queues } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
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

      <div className="entity-list">
        {sortedQueues.map((queue) => (
          <QueueRow key={queue.id} queue={queue} />
        ))}
      </div>
    </PanelState>
  )
}
