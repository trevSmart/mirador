import type { CSSProperties } from 'react'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { useCardActivation } from '../../hooks/useCardActivation'
import { colorFromRecordId } from '../../utils/color-from-string'
import { SfIcon } from '../ds'

/** Card compacta de cua per al flux del Dev Lab (no és la QueueCard del panell). */
export function QueueFlowCard({
  queueId,
  name,
  meta,
}: {
  queueId: string | null
  name: string
  meta: string
}) {
  const { openQueue } = useDetailDrawer()

  return (
    <article
      className="queue-flow-card"
      style={
        queueId
          ? ({ '--qflow-node-color': colorFromRecordId(queueId) } as CSSProperties)
          : undefined
      }
      {...useCardActivation(() => {
        if (queueId) openQueue(queueId)
      })}
    >
      <SfIcon name="queue" size={24} recordId={queueId} />
      <div className="queue-flow-card__body">
        <span
          className="queue-flow-card__name"
          title={name}
          style={queueId ? { color: colorFromRecordId(queueId) } : undefined}
        >
          {name}
        </span>
        <span className="queue-flow-card__meta">{meta}</span>
      </div>
    </article>
  )
}
