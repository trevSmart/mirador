import type { IDockviewPanelProps } from 'dockview'
import { useMiradorData } from '../api/MiradorDataProvider'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { sortQueuesByBacklog, totalQueueBacklog } from '../utils/agent-stats'

export function QueuesPanel({ api }: IDockviewPanelProps) {
  const { queues, isLoading, error, refresh } = useMiradorData()
  const sortedQueues = sortQueuesByBacklog(queues)

  return (
    <PanelState
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={queues.length === 0}
      emptyMessage="No hi ha cues configurades."
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
        {queues.length} cues · {totalQueueBacklog(queues)} treballs en cua
      </p>

      <div className="entity-list">
        {sortedQueues.map((queue) => (
          <QueueRow key={queue.id} queue={queue} />
        ))}
      </div>
    </PanelState>
  )
}
