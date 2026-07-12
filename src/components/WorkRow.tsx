import type { WorkItem } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useCardActivation } from '../hooks/useCardActivation'
import { colorFromRecordId } from '../utils/color-from-string'
import { channelLabel, formatSeconds, workStatusLabel } from '../utils/format'
import { resolveWorkItemIcon } from '../utils/salesforce-object-icon'
import { FadeValue, SfIcon } from './ds'

interface WorkRowProps {
  item: WorkItem
  agentName?: string | null
}

export function WorkRow({ item, agentName }: WorkRowProps) {
  const icon = resolveWorkItemIcon(item)
  const tint = colorFromRecordId(item.id)
  const { openWork } = useDetailDrawer()

  return (
    <article
      className="work-row work-row--clickable"
      {...useCardActivation(() => openWork(item.id))}
    >
      <div className="work-row__main">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={28} recordId={item.id} />
        <div className="work-row__body">
          <h3 className="work-row__subject" title={item.subject ?? undefined} style={{ color: tint }}>
            {item.subject}
          </h3>
          <p className="work-row__meta">
            {channelLabel(item.channelKey)} · <FadeValue value={formatSeconds(item.ageSec)} />
            {item.status === 'assigned' && agentName ? ` · ${agentName}` : ''}
          </p>
        </div>
        <span
          className={`work-row__status work-row__status--${item.status}`}
          title={workStatusLabel(item.status)}
        >
          {workStatusLabel(item.status)}
        </span>
      </div>
    </article>
  )
}
