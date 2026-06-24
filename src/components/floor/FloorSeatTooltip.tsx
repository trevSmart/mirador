import { useEffect, useRef } from 'react'
import type { Agent, PresenceStatus, Queue } from '../../api/types'
import { agentTowerSegments, towerSegmentLabel } from '../../floor/agent-tower-segments'
import { presenceLabel } from '../../utils/format'
import { DROPDOWN_TRANSITION_MS, syncDropdownPanel } from '../../utils/sync-dropdown-panel'
import { AgentAvatar } from '../AgentRow'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

function agentTeam(role: string): string {
  const sep = role.indexOf('·')
  return sep >= 0 ? role.slice(sep + 1).trim() : role
}

function detailLine(agent: Agent): string {
  const team = agentTeam(agent.role)
  if (agent.status === 'offline') return team
  const load = agent.max > 0 ? Math.round((agent.used / agent.max) * 100) : 0
  return `${agent.used}/${agent.max} · ${load}% · ${team}`
}

interface FloorSeatTooltipProps {
  agent: Agent
  queuesById: Map<string, Queue>
  x: number
  y: number
  open: boolean
  onExited?: () => void
}

export function FloorSeatTooltip({ agent, queuesById, x, y, open, onExited }: FloorSeatTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueSegments = agentTowerSegments(agent, queuesById)

  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(ref.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  useEffect(() => {
    if (open) return
    const id = setTimeout(() => onExited?.(), DROPDOWN_TRANSITION_MS)
    return () => clearTimeout(id)
  }, [open, onExited])

  return (
    <div
      ref={ref}
      className="fv3d-tip dropdown-panel"
      style={{ left: x, top: y }}
      role="tooltip"
      hidden
    >
      <div className="fv3d-tip__row">
        <AgentAvatar name={agent.name} photo={agent.photo} />
        <div className="fv3d-tip__main">
          <div className="fv3d-tip__name">{agent.name}</div>
          <div className="fv3d-tip__role">{agent.role}</div>
          <div className="fv3d-tip__status" style={{ color: STATUS_COLOR[agent.status] }}>
            <span
              className="fv3d-tip__dot"
              style={{ background: STATUS_COLOR[agent.status] }}
              aria-hidden="true"
            />
            {presenceLabel(agent.status)}
          </div>
        </div>
      </div>
      <div className="fv3d-tip__detail">{detailLine(agent)}</div>
      {queueSegments.length > 0 ? (
        <ul className="fv3d-tip__queues">
          {queueSegments.map((segment, index) => (
            <li key={segment.queueId ?? `unknown-${index}`} className="fv3d-tip__queue">
              <span className="fv3d-tip__queue-dot" style={{ background: segment.color }} aria-hidden="true" />
              <span className="fv3d-tip__queue-name">{towerSegmentLabel(segment, queuesById)}</span>
              <span className="fv3d-tip__queue-count">{segment.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
