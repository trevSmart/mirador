import { useMemo, useState } from 'react'
import type { Agent } from '../../api/types'
import type { SeatRef } from '../../space/useSpacePlan'
import { presenceLabel } from '../../utils/format'
import { AgentAvatar } from '../AgentRow'
import { Button } from '../ds'

interface AgentAssignPaletteProps {
  seat: SeatRef
  currentAgentId: string | null
  agents: Agent[]
  placedAgentIds: Set<string>
  onAssign: (c: number, r: number, agentId: string | null) => void
  onRemoveSeat: (c: number, r: number) => void
}

export function AgentAssignPalette({
  seat,
  currentAgentId,
  agents,
  placedAgentIds,
  onAssign,
  onRemoveSeat,
}: AgentAssignPaletteProps) {
  const [query, setQuery] = useState('')
  const current = currentAgentId ? agents.find((a) => a.id === currentAgentId) ?? null : null

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return agents
      .filter((agent) => agent.id === currentAgentId || !placedAgentIds.has(agent.id))
      .filter((agent) => !needle || agent.name.toLowerCase().includes(needle))
      .slice(0, 50)
  }, [agents, currentAgentId, placedAgentIds, query])

  return (
    <section className="fe-section fe-palette">
      <header className="fe-section__head">
        <h3 className="fe-section__title">Seient seleccionat</h3>
        <Button variant="ghost" size="sm" onClick={() => onRemoveSeat(seat.c, seat.r)}>
          Treu seient
        </Button>
      </header>

      <div className="fe-palette__current">
        {current ? (
          <>
            <AgentAvatar name={current.name} photo={current.photo} />
            <div className="fe-palette__current-info">
              <span className="fe-palette__current-name">{current.name}</span>
              <span className="fe-palette__current-meta">{presenceLabel(current.status)}</span>
            </div>
            <button
              type="button"
              className="fe-mini-btn"
              title="Desassigna l'agent"
              onClick={() => onAssign(seat.c, seat.r, null)}
            >
              ✕
            </button>
          </>
        ) : (
          <span className="fe-palette__empty">Sense agent assignat</span>
        )}
      </div>

      <input
        className="fe-palette__search"
        type="search"
        placeholder="Cerca un agent…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="fe-palette__list">
        {available.length === 0 ? (
          <p className="fe-palette__none">No hi ha agents disponibles.</p>
        ) : (
          available.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`fe-palette__item${agent.id === currentAgentId ? ' fe-palette__item--on' : ''}`}
              onClick={() => onAssign(seat.c, seat.r, agent.id)}
            >
              <AgentAvatar name={agent.name} photo={agent.photo} />
              <span className="fe-palette__item-name">{agent.name}</span>
              <span className="fe-palette__item-status" data-status={agent.status}>
                {presenceLabel(agent.status)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
