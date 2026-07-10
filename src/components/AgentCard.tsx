import type { Agent } from '../api/types'
import { useDetailActivation } from '../detail/useDetailActivation'
import { capacityColor } from '../utils/agent-stats'
import { formatMinutes } from '../utils/format'
import { AgentRing } from './AgentRow'
import { CapacityBar } from './ds'
import { StatusBadge } from './StatusBadge'

export function AgentCard({ agent }: { agent: Agent }) {
  const activation = useDetailActivation({ kind: 'agent', id: agent.id })
  const color = capacityColor(agent)

  return (
    <article className="agent-card" {...activation}>
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
