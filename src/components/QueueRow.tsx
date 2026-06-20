import type { Queue } from '../api/types'
import { formatSeconds } from '../utils/format'
import { PressureBar, SfIcon } from './ds'

/** Backlog count that reads as "full" pressure on the bar. */
const BACKLOG_FULL = 20

interface QueueRowProps {
  queue: Queue
}

export function QueueRow({ queue }: QueueRowProps) {
  const pressure = Math.min(1, queue.backlog / BACKLOG_FULL)

  return (
    <article className="queue-row">
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
