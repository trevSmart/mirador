/* ──────────────────────────────────────────────────────────────────────────
   Dev Lab — panell de proves per a experiments de desenvolupament.
   ────────────────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import type { Agent, PresenceStatus } from '../api/types'
import { useAgents } from '../api/data-hooks'
import { AgentCard } from '../components/AgentCard'
import { capacityColor } from '../utils/agent-stats'
import { colorFromRecordId, textColorFromRecordId } from '../utils/color-from-string'
import { agentInitials } from '../utils/format'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { CapacityBar } from '../components/ds'
import { StatusBadge } from '../components/StatusBadge'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

/** Snapshot de com era `AgentCard` ahir (commit 0f77c7b, 2026-07-09), abans del refactor d'avui amb ring + tooltip. */
function AgentCardLegacy({ agent }: { agent: Agent }) {
  const color = STATUS_COLOR[agent.status]
  const photoSrc = useSalesforcePhoto(agent.photo)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  return (
    <article className="agent-card-legacy">
      <div className="agent-card-legacy__avatar-wrap">
        {photoSrc && photoSrc !== failedSrc ? (
          <img
            className="agent-card-legacy__avatar agent-card-legacy__avatar--photo"
            src={photoSrc}
            alt=""
            aria-hidden="true"
            onError={() => setFailedSrc(photoSrc)}
          />
        ) : (
          <span
            className="agent-card-legacy__avatar"
            style={{ background: colorFromRecordId(agent.id), color: textColorFromRecordId(agent.id) }}
            aria-hidden="true"
          >
            {agentInitials(agent.name)}
          </span>
        )}
        <span className="agent-card-legacy__status-dot" style={{ background: color }} />
      </div>

      <div className="agent-card-legacy__body">
        <p className="agent-card-legacy__name">{agent.name}</p>
        <p className="agent-card-legacy__role">{agent.role}</p>
        <CapacityBar
          used={agent.used}
          max={agent.max}
          color={capacityColor(agent)}
          showHead={false}
          style={{ marginTop: 4 }}
        />
      </div>

      <StatusBadge status={agent.status} soft />
    </article>
  )
}

/** Snapshot de com era `AgentCard` fa 4 dies (commit 029dc96, 2026-07-02), abans d'afegir la capacity bar. */
function AgentCardLegacyNoBar({ agent }: { agent: Agent }) {
  const color = STATUS_COLOR[agent.status]
  const photoSrc = useSalesforcePhoto(agent.photo)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  return (
    <article className="agent-card-legacy">
      <div className="agent-card-legacy__avatar-wrap">
        {photoSrc && photoSrc !== failedSrc ? (
          <img
            className="agent-card-legacy__avatar agent-card-legacy__avatar--photo"
            src={photoSrc}
            alt=""
            aria-hidden="true"
            onError={() => setFailedSrc(photoSrc)}
          />
        ) : (
          <span
            className="agent-card-legacy__avatar"
            style={{ background: colorFromRecordId(agent.id), color: textColorFromRecordId(agent.id) }}
            aria-hidden="true"
          >
            {agentInitials(agent.name)}
          </span>
        )}
        <span className="agent-card-legacy__status-dot" style={{ background: color }} />
      </div>

      <div className="agent-card-legacy__body">
        <p className="agent-card-legacy__name">{agent.name}</p>
        <p className="agent-card-legacy__role">{agent.role}</p>
      </div>

      <StatusBadge status={agent.status} soft />
    </article>
  )
}

export function DevLabPanel() {
  const agents = useAgents()
  const sample = agents.slice(0, 6)

  return (
    <div className="dev-lab">
      <div className="dev-lab-compare">
        <p className="dev-lab-compare__label">Aspecte actual</p>
        <div className="agents-grid">
          {sample.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <div className="dev-lab-compare">
        <p className="dev-lab-compare__label">Aspecte d'ahir (abans del refactor d'avui)</p>
        <div className="agents-grid">
          {sample.map((agent) => (
            <AgentCardLegacy key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <div className="dev-lab-compare">
        <p className="dev-lab-compare__label">Aspecte de fa 4 dies (abans de la capacity bar)</p>
        <div className="agents-grid">
          {sample.map((agent) => (
            <AgentCardLegacyNoBar key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
