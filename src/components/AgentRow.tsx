import type { Agent, ChannelKey, PresenceStatus } from '../api/types'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { agentInitials, formatMinutes } from '../utils/format'
import { CapacityBar, Ring, SfIcon } from './ds'
import { StatusBadge } from './StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const CHANNELS: ChannelKey[] = ['veu', 'chat', 'wa', 'cas']

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

interface AgentRingProps {
  agent: Agent
  color: string
}

/** Capacity ring with the agent's resolved photo (or initials) inside. */
function AgentRing({ agent, color }: AgentRingProps) {
  const photoSrc = useSalesforcePhoto(agent.photo)
  return (
    <Ring
      used={agent.used}
      max={agent.max}
      color={color}
      size={44}
      photo={photoSrc}
      initials={agentInitials(agent.name)}
      breathe={agent.status === 'busy'}
    />
  )
}

interface AgentRowProps {
  agent: Agent
  showSkills?: boolean
}

export function AgentRow({ agent, showSkills = false }: AgentRowProps) {
  const queueCount = agent.queueIds.length
  const skillNames = agent.skills.map((skill) => skill.name).slice(0, 3)
  const color = STATUS_COLOR[agent.status]

  return (
    <article className="agent-row">
      <div className="agent-row__main">
        <AgentRing agent={agent} color={color} />
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

      <CapacityBar used={agent.used} max={agent.max} color={color} />

      <div className="agent-row__channels">
        {CHANNELS.map((channel) => {
          const count = agent.chans[channel] ?? 0
          const active = count > 0
          return (
            <div
              key={channel}
              className="agent-row__channel"
              data-active={active ? 'true' : 'false'}
            >
              <SfIcon channel={channel} size={18} />
              <span className="agent-row__channel-count">{count}</span>
            </div>
          )
        })}
      </div>

      <div className="agent-row__metrics">
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
