import type { Agent, ChannelKey, PresenceStatus } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { colorFromRecordId, textColorFromRecordId } from '../utils/color-from-string'
import { agentInitials, formatMinutes } from '../utils/format'
import { CapacityBar, FadeValue, MetricPill, Ring, SfIcon } from './ds'
import { StatusBadge } from './StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const CHANNELS: ChannelKey[] = ['veu', 'chat', 'wa', 'cas']

interface AgentAvatarProps {
  id: string
  name: string
  photo?: string | null
}

export function AgentAvatar({ id, name, photo = null }: AgentAvatarProps) {
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
    <span
      className="agent-avatar"
      style={{ background: colorFromRecordId(id), color: textColorFromRecordId(id) }}
      aria-hidden="true"
    >
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
      size={50}
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
  const { openAgent } = useDetailDrawer()

  return (
    <article
      className="agent-row agent-row--clickable"
      role="button"
      tabIndex={0}
      onClick={() => openAgent(agent.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openAgent(agent.id)
        }
      }}
    >
      <div className="agent-row__main">
        <AgentRing agent={agent} color={color} />
        <div className="agent-row__info">
          <div className="agent-row__title">
            <span className="agent-row__name">{agent.name}</span>
            <StatusBadge
              status={agent.status}
              label={agent.presenceStatusLabel}
              compact
            />
          </div>
          <p className="agent-row__meta">
            {agent.role}
            {agent.loginMin > 0 ? (
              <>
                {' · '}
                <FadeValue value={formatMinutes(agent.loginMin)} /> en estat actual
              </>
            ) : (
              ''
            )}
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
              <SfIcon channel={channel} sldsSize="small" />
              <FadeValue className="agent-row__channel-count" value={count} />
            </div>
          )
        })}
      </div>

      <div className="agent-row__metrics">
        <MetricPill label="Treball actiu" value={agent.work.length} />
        <MetricPill label="Cues" value={queueCount} />
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
