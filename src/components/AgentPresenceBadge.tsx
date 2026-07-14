import { useEffect, useRef, useState } from 'react'
import type { Agent } from '../api/types'
import { formatMinutes } from '../utils/format'
import { StatusBadge } from './StatusBadge'
import { Tooltip } from './ds/Tooltip'

interface AgentPresenceBadgeProps {
  agent: Agent
  compact?: boolean
}

/** Presence badge with an optional duration tooltip (time in current status). */
export function AgentPresenceBadge({ agent, compact = true }: AgentPresenceBadgeProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const [rowFocused, setRowFocused] = useState(false)
  const durationLabel =
    agent.loginMin > 0 ? `${formatMinutes(agent.loginMin)} en estat actual` : null

  useEffect(() => {
    if (!durationLabel) return
    const anchor = anchorRef.current
    const row = anchor?.closest<HTMLElement>('.agent-row, .agent-card')
    if (!row) return

    const syncRowFocus = () => {
      setRowFocused(row.matches(':focus-visible'))
    }

    syncRowFocus()
    row.addEventListener('focusin', syncRowFocus)
    row.addEventListener('focusout', syncRowFocus)
    return () => {
      row.removeEventListener('focusin', syncRowFocus)
      row.removeEventListener('focusout', syncRowFocus)
    }
  }, [durationLabel])

  const tooltipOpen = Boolean(durationLabel && (hovered || rowFocused))

  return (
    <>
      <span
        ref={anchorRef}
        className="agent-row__status-hover"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <StatusBadge status={agent.status} label={agent.presenceStatusLabel} compact={compact} />
        {durationLabel ? <span className="visually-hidden">{durationLabel}</span> : null}
      </span>
      {durationLabel ? (
        <Tooltip anchorRef={anchorRef} open={tooltipOpen} content={durationLabel} />
      ) : null}
    </>
  )
}
