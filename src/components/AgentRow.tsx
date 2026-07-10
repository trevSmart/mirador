import { useState } from 'react'
import type { Agent, ChannelKey } from '../api/types'
import { useDetailActivation } from '../detail/useDetailActivation'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { capacityColor } from '../utils/agent-stats'
import { colorFromRecordId, textColorFromRecordId } from '../utils/color-from-string'
import { agentInitials, formatMinutes } from '../utils/format'
import { CapacityBar, FadeValue, MetricPill, Ring, SfIcon } from './ds'
import { StatusBadge } from './StatusBadge'

const CHANNELS: ChannelKey[] = ['veu', 'chat', 'wa', 'cas']

interface AgentAvatarProps {
  id: string
  name: string
  photo?: string | null
}

export function AgentAvatar({ id, name, photo = null }: AgentAvatarProps) {
  const photoSrc = useSalesforcePhoto(photo)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (photoSrc && photoSrc !== failedSrc) {
    return (
      <img
        className="agent-avatar agent-avatar--photo"
        src={photoSrc}
        alt=""
        aria-hidden="true"
        onError={() => setFailedSrc(photoSrc)}
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
export function AgentRing({ agent, color }: AgentRingProps) {
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
  const color = capacityColor(agent)
  const activation = useDetailActivation({ kind: 'agent', id: agent.id })

  return (
    <article className="agent-row agent-row--clickable" {...activation}>
      <div className="agent-row__main">
        <AgentRing agent={agent} color={color} />
        <div className="agent-row__info">
          <div className="agent-row__title">
            <span className="agent-row__name">{agent.name}</span>
            <span
              className="agent-row__status-hover"
              data-tooltip={agent.loginMin > 0 ? `${formatMinutes(agent.loginMin)} en estat actual` : undefined}
            >
              <StatusBadge
                status={agent.status}
                label={agent.presenceStatusLabel}
                compact
              />
              {agent.loginMin > 0 && (
                <span className="visually-hidden">{`${formatMinutes(agent.loginMin)} en estat actual`}</span>
              )}
            </span>
          </div>
          <p className="agent-row__meta">{agent.role}</p>
        </div>
      </div>

      <CapacityBar used={agent.used} max={agent.max} color={capacityColor(agent)} />

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
