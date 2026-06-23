import { useMemo } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { edgeStyle } from '../../floor/floor-geometry'
import { cellKey } from '../../floor/floor-plan-model'
import type { Floor } from '../../floor/types'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { agentInitials, presenceLabel } from '../../utils/format'
import { Ring } from '../ds'

/** Larger cells than the editor: supervisors read avatars and rings at a glance. */
const VIEW_CELL = 46

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

interface FloorSeatProps {
  agent: Agent
  onSelect: (agent: Agent) => void
}

function FloorSeat({ agent, onSelect }: FloorSeatProps) {
  const photo = useSalesforcePhoto(agent.photo)
  return (
    <button
      type="button"
      className="fv-seat"
      title={`${agent.name} · ${presenceLabel(agent.status)} · ${agent.used}/${agent.max}`}
      onClick={() => onSelect(agent)}
    >
      <Ring
        used={agent.used}
        max={agent.max}
        color={STATUS_COLOR[agent.status]}
        size={VIEW_CELL - 10}
        photo={photo}
        initials={agentInitials(agent.name)}
        breathe={agent.status === 'busy'}
      />
    </button>
  )
}

interface FloorViewProps {
  floor: Floor
  agentsById: Map<string, Agent>
  onSelectAgent: (agent: Agent) => void
}

export function FloorView({ floor, agentsById, onSelectAgent }: FloorViewProps) {
  const seatByKey = useMemo(() => {
    const map = new Map<string, Floor['seats'][number]>()
    for (const seat of floor.seats) map.set(cellKey(seat.c, seat.r), seat)
    return map
  }, [floor.seats])

  // Crop to the room: the supervision view shows only the drawn floor, not the
  // full editor canvas. Everything is positioned relative to the cells' bounds.
  const bounds = useMemo(() => {
    if (floor.cells.length === 0) return { minC: 0, minR: 0, cols: 1, rows: 1 }
    let minC = Infinity
    let minR = Infinity
    let maxC = -Infinity
    let maxR = -Infinity
    for (const [c, r] of floor.cells) {
      minC = Math.min(minC, c)
      minR = Math.min(minR, r)
      maxC = Math.max(maxC, c)
      maxR = Math.max(maxR, r)
    }
    return { minC, minR, cols: maxC - minC + 1, rows: maxR - minR + 1 }
  }, [floor.cells])

  const { minC, minR } = bounds

  return (
    <div
      className="fv-grid"
      style={{ width: bounds.cols * VIEW_CELL, height: bounds.rows * VIEW_CELL }}
    >
      {floor.background ? (
        <div
          className="fe-grid__bg"
          style={{ opacity: floor.backgroundOpacity }}
          data-bg={floor.background}
        />
      ) : null}

      {floor.cells.map(([c, r]) => {
        const seat = seatByKey.get(cellKey(c, r))
        const agent = seat?.agentId ? agentsById.get(seat.agentId) ?? null : null
        return (
          <div
            key={cellKey(c, r)}
            className="fv-cell"
            style={{
              left: (c - minC) * VIEW_CELL,
              top: (r - minR) * VIEW_CELL,
              width: VIEW_CELL,
              height: VIEW_CELL,
            }}
          >
            {seat ? (
              agent ? (
                <FloorSeat agent={agent} onSelect={onSelectAgent} />
              ) : (
                <span className="fv-seat fv-seat--vacant" title="Seient lliure" />
              )
            ) : null}
          </div>
        )
      })}

      {floor.dividers.map((d) => (
        <div
          key={`div-${d.c}-${d.r}-${d.edge}`}
          className="fe-edge fe-edge--divider"
          style={edgeStyle(d.c - minC, d.r - minR, d.edge, VIEW_CELL)}
        />
      ))}

      {floor.openings.map((o) => (
        <div
          key={`op-${o.c}-${o.r}-${o.edge}`}
          className={`fe-edge fe-edge--${o.kind}`}
          style={edgeStyle(o.c - minC, o.r - minR, o.edge, VIEW_CELL)}
        />
      ))}
    </div>
  )
}
