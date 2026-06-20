import type { Agent } from '../api/types'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { agentInitials, formatMinutes } from '../utils/format'
import { StatusBadge } from './StatusBadge'

interface AgentAvatarProps {
  name: string
  photo?: string | null
}

export function AgentAvatar({ name, photo = null }: AgentAvatarProps) {
  const photoSrc = useSalesforcePhoto(photo)

  if (photoSrc) {
    return (
      <img
        className="agent-avatar agent-avatar--photo"
        src={photoSrc}
        alt=""
        aria-hidden="true"
      />
    )
  }

  return (
    <span className="agent-avatar" aria-hidden="true">
      {agentInitials(name)}
    </span>
  )
}

interface AgentRowProps {
  agent: Agent
  showSkills?: boolean
}

export function AgentRow({ agent, showSkills = false }: AgentRowProps) {
  const queueCount = agent.queueIds.length
  const skillNames = agent.skills.map((skill) => skill.name).slice(0, 3)

  return (
    <article className="agent-row">
      <div className="agent-row__main">
        <AgentAvatar name={agent.name} photo={agent.photo} />
        <div className="agent-row__info">
          <div className="agent-row__title">
            {agent.recordUrl ? (
              <a
                className="agent-row__name"
                href={agent.recordUrl}
                target="_blank"
                rel="noreferrer"
              >
                {agent.name}
              </a>
            ) : (
              <span className="agent-row__name">{agent.name}</span>
            )}
            <StatusBadge status={agent.status} />
          </div>
          <p className="agent-row__meta">
            {agent.role}
            {agent.loginMin > 0 ? ` · ${formatMinutes(agent.loginMin)} en estat actual` : ''}
          </p>
        </div>
      </div>

      <div className="agent-row__metrics">
        <div className="metric-pill">
          <span className="metric-pill__label">Capacitat</span>
          <span className="metric-pill__value">
            {agent.used}/{agent.max}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__label">Treball actiu</span>
          <span className="metric-pill__value">{agent.work.length}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__label">Cues</span>
          <span className="metric-pill__value">{queueCount}</span>
        </div>
      </div>

      {showSkills && skillNames.length > 0 ? (
        <p className="agent-row__skills">
          Skills: {skillNames.join(', ')}
          {agent.skills.length > skillNames.length
            ? ` +${agent.skills.length - skillNames.length}`
            : ''}
        </p>
      ) : null}
    </article>
  )
}
