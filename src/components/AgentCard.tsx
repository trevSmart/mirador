import type { Agent } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useCardActivation } from '../hooks/useCardActivation'
import { capacityColor } from '../utils/agent-stats'
import { AgentRing } from './AgentRow'
import { AgentPresenceBadge } from './AgentPresenceBadge'
import { CapacityBar } from './ds'

export function AgentCard({
  agent,
  showCapacityHead = true,
  ringSize,
}: {
  agent: Agent
  /** Capçalera «Capacitat · used/max» sobre la barra de segments. */
  showCapacityHead?: boolean
  /** Mida del ring d'avatar (per defecte 50, com al panell d'agents). */
  ringSize?: number
}) {
  const { openAgent } = useDetailDrawer()
  const color = capacityColor(agent)

  return (
    <article className="agent-card" {...useCardActivation(() => openAgent(agent.id))}>
      <div className="agent-row__main">
        <AgentRing agent={agent} color={color} size={ringSize} />
        <div className="agent-row__info">
          <div className="agent-row__title">
            <span className="agent-row__name">{agent.name}</span>
            <AgentPresenceBadge agent={agent} />
          </div>
          <p className="agent-row__meta">{agent.role}</p>
        </div>
      </div>

      <CapacityBar
        used={agent.used}
        max={agent.max}
        color={capacityColor(agent)}
        showHead={showCapacityHead}
      />
    </article>
  )
}
