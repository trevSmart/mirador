import type { WorkItem } from '../api/types'
import { channelLabel, formatSeconds, workStatusLabel } from '../utils/format'
import { resolveWorkItemIcon } from '../utils/salesforce-object-icon'
import { SfIcon } from './ds'

interface WorkRowProps {
  item: WorkItem
  agentName?: string | null
  queueName?: string | null
}

export function WorkRow({ item, agentName, queueName }: WorkRowProps) {
  const icon = resolveWorkItemIcon(item)
  const metaParts = [
    channelLabel(item.channelKey),
    workStatusLabel(item.status),
    formatSeconds(item.ageSec),
  ]

  if (item.status === 'assigned' && agentName) {
    metaParts.push(agentName)
  }

  if (queueName) {
    metaParts.push(queueName)
  }

  return (
    <article className="work-row">
      <div className="work-row__main">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={32} bg={icon.tint} />
        <div className="work-row__body">
          <h3 className="work-row__subject">{item.subject}</h3>
          <p className="work-row__meta">{metaParts.join(' · ')}</p>
        </div>
        <span className={`work-row__status work-row__status--${item.status}`}>
          {workStatusLabel(item.status)}
        </span>
      </div>
    </article>
  )
}
