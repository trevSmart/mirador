import type { Queue } from '../api/types'
import { useDetailDrawer } from '../detail/DetailDrawerContext'
import { formatSeconds } from '../utils/format'
import { PressureBar, SfIcon } from './ds'

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
        <SfIcon name="queue" size={32} bg={queue.color} />
        <div>
          <h3 className="queue-row__name">{queue.name}</h3>
          <p className="queue-row__meta">{queue.online} agents en línia</p>
        </div>
      </div>

      <PressureBar value={pressure} />

      <div className="queue-row__metrics">
        <div className="metric-pill">
          <span className="metric-pill__label">Backlog</span>
          <span className="metric-pill__value">{queue.backlog}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__label">Màxim</span>
          <span className="metric-pill__value">{formatSeconds(queue.longest)}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__label">Mitjana</span>
          <span className="metric-pill__value">{formatSeconds(queue.avg)}</span>
        </div>
      </div>
    </article>
  )
}
