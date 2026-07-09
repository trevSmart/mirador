import type { Agent, PresenceStatus } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { capacityColor } from '../utils/agent-stats'
import { formatMinutes } from '../utils/format'
import { AgentRing } from './AgentRow'
import { CapacityBar } from './ds'
import { StatusBadge } from './StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
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
      <div className="agent-row__main">
        <AgentRing agent={agent} color={color} />
        <div className="agent-row__info">
          <div className="agent-row__title">
            <span className="agent-row__name">{agent.name}</span>
            <span
              className="agent-row__status-hover"
              data-tooltip={agent.loginMin > 0 ? `${formatMinutes(agent.loginMin)} en estat actual` : undefined}
            >
              <StatusBadge status={agent.status} label={agent.presenceStatusLabel} compact />
              {agent.loginMin > 0 && (
                <span className="visually-hidden">{`${formatMinutes(agent.loginMin)} en estat actual`}</span>
              )}
            </span>
          </div>
          <p className="agent-row__meta">{agent.role}</p>
        </div>
      </div>

      <CapacityBar used={agent.used} max={agent.max} color={capacityColor(agent)} />
    </article>
  )
}
