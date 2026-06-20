import type { Queue } from '../api/types'
import { formatSeconds } from '../utils/format'

interface QueueRowProps {
  queue: Queue
}

export function QueueRow({ queue }: QueueRowProps) {
  return (
    <article className="queue-row">
      <div className="queue-row__main">
        <span
          className="queue-row__color"
          style={{ backgroundColor: queue.color }}
          aria-hidden="true"
        />
        <div>
          <h3 className="queue-row__name">{queue.name}</h3>
          <p className="queue-row__meta">{queue.online} agents en línia</p>
        </div>
      </div>

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
