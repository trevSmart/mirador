import { useState } from 'react'
import type { Agent, PresenceStatus } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { colorFromRecordId, textColorFromRecordId } from '../utils/color-from-string'
import { agentInitials } from '../utils/format'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { StatusBadge } from './StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

function AgentCardAvatar({ id, name, photo, color }: { id: string; name: string; photo: string | null; color: string }) {
  const photoSrc = useSalesforcePhoto(photo)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  return (
    <div className="agent-card__avatar-wrap">
      {photoSrc && photoSrc !== failedSrc ? (
        <img
          className="agent-card__avatar agent-card__avatar--photo"
          src={photoSrc}
          alt=""
          aria-hidden="true"
          onError={() => setFailedSrc(photoSrc)}
        />
      ) : (
        <span
          className="agent-card__avatar"
          style={{ background: colorFromRecordId(id), color: textColorFromRecordId(id) }}
          aria-hidden="true"
        >
          {agentInitials(name)}
        </span>
      )}
      <span className="agent-card__status-dot" style={{ background: color }} />
    </div>
  )
}

export function AgentCard({ agent }: { agent: Agent }) {
  const { openAgent } = useDetailDrawer()
  const color = STATUS_COLOR[agent.status]

  return (
    <article
      className="agent-card"
      role="button"
      tabIndex={0}
      onClick={() => openAgent(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openAgent(agent.id)
        }
      }}
    >
      <AgentCardAvatar id={agent.id} name={agent.name} photo={agent.photo} color={color} />

      <div className="agent-card__body">
        <p className="agent-card__name">{agent.name}</p>
        <p className="agent-card__role">{agent.role}</p>
      </div>

      <StatusBadge status={agent.status} soft />
    </article>
  )
}
