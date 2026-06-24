import type { Queue } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { formatSeconds } from '../utils/format'
import { FadeValue, MetricPill, PressureBar, SfIcon } from './ds'

/** Backlog count that reads as "full" pressure on the bar. */
const BACKLOG_FULL = 20

interface QueueRowProps {
  queue: Queue
}

export function QueueRow({ queue }: QueueRowProps) {
  const pressure = Math.min(1, queue.backlog / BACKLOG_FULL)
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
        <SfIcon name="queue" sldsSize="medium" bg={queue.color} />
        <div className="queue-row__body">
          <h3 className="queue-row__name" title={queue.name}>{queue.name}</h3>
          <p className="queue-row__meta">
            <FadeValue value={queue.online} /> agents en línia
          </p>
        </div>
      </div>

      <PressureBar value={pressure} />

      <div className="queue-row__metrics">
        <MetricPill label="Backlog" value={queue.backlog} />
        <MetricPill label="Màxim" value={formatSeconds(queue.longest)} />
        <MetricPill label="Mitjana" value={formatSeconds(queue.avg)} />
      </div>
    </article>
  )
}
