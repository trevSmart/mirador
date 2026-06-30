import type { Queue } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { colorFromRecordId } from '../utils/color-from-string'
import { formatSeconds } from '../utils/format'
import { FadeValue, MetricPill, SfIcon } from './ds'

interface QueueRowProps {
  queue: Queue
}

export function QueueRow({ queue }: QueueRowProps) {
  const { openQueue } = useDetailDrawer()

  return (
    <article
      className="queue-row queue-row--clickable"
      role="button"
      tabIndex={0}
      onClick={() => openQueue(queue.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openQueue(queue.id)
        }
      }}
    >
      <div className="queue-row__main">
        <SfIcon name="queue" sldsSize="medium" bg={colorFromRecordId(queue.id)} />
        <div className="queue-row__body">
          <h3 className="queue-row__name" title={queue.name} style={{ color: colorFromRecordId(queue.id) }}>
            {queue.name}
          </h3>
          <p className="queue-row__meta">
            <FadeValue value={queue.online} /> agents en línia
          </p>
        </div>
      </div>

      <div className="queue-row__metrics">
        <MetricPill label="Backlog" value={queue.backlog} />
        <MetricPill label="Màxim" value={formatSeconds(queue.longest)} />
        <MetricPill label="Mitjana" value={formatSeconds(queue.avg)} />
      </div>
    </article>
  )
}
