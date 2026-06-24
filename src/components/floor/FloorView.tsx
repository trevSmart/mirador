import { useMemo } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { edgeStyle } from '../../floor/floor-geometry'
import { cellKey, GRID_C } from '../../floor/floor-plan-model'
import { rotateCell, rotateEdge, roomBounds2D } from '../../floor/floor-iso'
import type { Dir, Floor } from '../../floor/types'
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
  showAvatars: boolean
  animations: boolean
}

function FloorSeat({ agent, onSelect, showAvatars, animations }: FloorSeatProps) {
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
        photo={showAvatars ? photo : null}
        initials={agentInitials(agent.name)}
        breathe={animations && agent.status === 'busy'}
      />
    </button>
  )
}

interface FloorViewProps {
  floor: Floor
  dir?: Dir
  agentsById: Map<string, Agent>
  onSelectAgent: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

export function FloorView({ floor, dir = 0, agentsById, onSelectAgent, showAvatars, animations }: FloorViewProps) {
  // Rotate every element into the camera frame, then crop to the rotated room.
  const rotated = useMemo(() => {
    const cells = floor.cells.map(([c, r]) => rotateCell(c, r, dir, GRID_C))
    const seatByKey = new Map<string, Floor['seats'][number]>()
    for (const seat of floor.seats) {
      const [rc, rr] = rotateCell(seat.c, seat.r, dir, GRID_C)
      seatByKey.set(cellKey(rc, rr), { ...seat, c: rc, r: rr })
    }
    const dividers = floor.dividers.map((d) => {
      const [rc, rr] = rotateCell(d.c, d.r, dir, GRID_C)
      return { ...d, c: rc, r: rr, edge: rotateEdge(d.edge, dir) }
    })
    const openings = floor.openings.map((o) => {
      const [rc, rr] = rotateCell(o.c, o.r, dir, GRID_C)
      return { ...o, c: rc, r: rr, edge: rotateEdge(o.edge, dir) }
    })
    return { cells, seatByKey, dividers, openings }
  }, [floor, dir])

  const bounds = useMemo(() => roomBounds2D(floor.cells, dir, GRID_C), [floor.cells, dir])
  const { minC, minR, cols, rows } = bounds

  return (
    <div className="fv-fit">
      <div
        className="fv-grid"
        style={{ width: cols * VIEW_CELL, height: rows * VIEW_CELL }}
      >
        {floor.background ? (
          <div
            className="fe-grid__bg"
            style={{ opacity: floor.backgroundOpacity }}
            data-bg={floor.background}
          />
        ) : null}

        {rotated.cells.map(([c, r]) => {
          const seat = rotated.seatByKey.get(cellKey(c, r))
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
                  <FloorSeat
                    agent={agent}
                    onSelect={onSelectAgent}
                    showAvatars={showAvatars}
                    animations={animations}
                  />
                ) : (
                  <span className="fv-seat fv-seat--vacant" title="Seient lliure" />
                )
              ) : null}
            </div>
          )
        })}

        {rotated.dividers.map((d) => (
          <div
            key={`div-${d.c}-${d.r}-${d.edge}`}
            className="fe-edge fe-edge--divider"
            style={edgeStyle(d.c - minC, d.r - minR, d.edge, VIEW_CELL)}
          />
        ))}

        {rotated.openings.map((o) => (
          <div
            key={`op-${o.c}-${o.r}-${o.edge}`}
            className={`fe-edge fe-edge--${o.kind}`}
            style={edgeStyle(o.c - minC, o.r - minR, o.edge, VIEW_CELL)}
          />
        ))}
      </div>
    </div>
  )
}
