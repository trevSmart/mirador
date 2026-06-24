import type { Agent, PresenceStatus } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { agentInitials } from '../utils/format'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { FadeValue } from './ds'
import { StatusBadge } from './StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

function AgentCardAvatar({ name, photo, color }: { name: string; photo: string | null; color: string }) {
  const photoSrc = useSalesforcePhoto(photo)

  return (
    <div className="agent-card__avatar-wrap">
      {photoSrc ? (
        <img className="agent-card__avatar agent-card__avatar--photo" src={photoSrc} alt="" aria-hidden="true" />
      ) : (
        <span className="agent-card__avatar" aria-hidden="true">
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
      <AgentCardAvatar name={agent.name} photo={agent.photo} color={color} />

      <p className="agent-card__name">{agent.name}</p>

      <StatusBadge status={agent.status} />

      <p className="agent-card__role">{agent.role}</p>

      <div className="agent-card__metrics">
        <span className="agent-card__metric">
          <FadeValue className="agent-card__metric-value" value={agent.work.length} />
          <span className="agent-card__metric-label">actiu</span>
        </span>
        <span className="agent-card__metric">
          <span className="agent-card__metric-value">
            <FadeValue value={agent.used} />/<FadeValue value={agent.max} />
          </span>
          <span className="agent-card__metric-label">cap.</span>
        </span>
        <span className="agent-card__metric">
          <FadeValue className="agent-card__metric-value" value={agent.queueIds.length} />
          <span className="agent-card__metric-label">cues</span>
        </span>
      </div>
    </article>
  )
}
