import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { WorkItem } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
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
  const target = () => openWork(item.id)

  return (
    <article
      className="work-row work-row--clickable"
      role="button"
      tabIndex={0}
      onClick={target}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          target()
        }
      }}
    >
      <div className="work-row__main">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={28} bg={tint} />
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
