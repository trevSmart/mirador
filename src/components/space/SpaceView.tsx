import { useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { edgeStyle } from '../../space/space-geometry'
import { cellKey, GRID_C } from '../../space/space-plan-model'
import { rotateCell, rotateEdge, roomBounds2D } from '../../space/space-iso'
import type { Dir, Space } from '../../space/types'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { colorFromString } from '../../utils/color-from-string'
import { agentInitials, presenceLabel } from '../../utils/format'
import { Ring } from '../ds'
import { roomAspect } from './space-view-aspect'

/** Larger cells than the editor: supervisors read avatars and rings at a glance. */
const VIEW_CELL = 46

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

interface SpaceSeatProps {
  agent: Agent
  onSelect: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

function SpaceSeat({ agent, onSelect, showAvatars, animations }: SpaceSeatProps) {
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
        faceBg={colorFromString(agent.name)}
        breathe={animations && agent.status === 'busy'}
      />
    </button>
  )
}

interface SpaceViewProps {
  space: Space
  dir: Dir
  agentsById: Map<string, Agent>
  onSelectAgent: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

export function SpaceView({
  space,
  dir,
  agentsById,
  onSelectAgent,
  showAvatars,
  animations,
}: SpaceViewProps) {
  // Rotate every element into the camera frame, then crop to the rotated room.
  const rotated = useMemo(() => {
    const cells = space.cells.map(([c, r]) => rotateCell(c, r, dir, GRID_C))
    const seatByKey = new Map<string, Space['seats'][number]>()
    for (const seat of space.seats) {
      const [rc, rr] = rotateCell(seat.c, seat.r, dir, GRID_C)
      seatByKey.set(cellKey(rc, rr), { ...seat, c: rc, r: rr })
    }
    const dividers = space.dividers.map((d) => {
      const [rc, rr] = rotateCell(d.c, d.r, dir, GRID_C)
      return { ...d, c: rc, r: rr, edge: rotateEdge(d.edge, dir) }
    })
    const openings = space.openings.map((o) => {
      const [rc, rr] = rotateCell(o.c, o.r, dir, GRID_C)
      return { ...o, c: rc, r: rr, edge: rotateEdge(o.edge, dir) }
    })
    return { cells, seatByKey, dividers, openings }
  }, [space, dir])

  const bounds = useMemo(() => roomBounds2D(space.cells, dir, GRID_C), [space.cells, dir])
  const { minC, minR, cols, rows } = bounds

  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const gridW = cols * VIEW_CELL
  const gridH = rows * VIEW_CELL

  // The .fv-fit box targets the shared render height and derives its width from
  // the room's aspect-ratio (--fv-aspect-n is that ratio as a number, used by the
  // CSS width calc; --fv-aspect is the same ratio as a CSS aspect-ratio string).
  // We still need the rendered width to scale the raw-pixel .fv-grid down to fit.
  const aspectN = (cols > 0 ? cols : 1) / (rows > 0 ? rows : 1)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const cw = entry.contentRect.width
      if (!gridW || !isFinite(cw) || cw === 0) return
      const next = cw / gridW
      if (!isFinite(next) || next === 0) return
      setScale((prev) => (prev === next ? prev : next))
    })
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [gridW])

  return (
    <div
      className="fv-fit"
      ref={containerRef}
      style={{
        ['--fv-aspect' as string]: roomAspect(cols, rows),
        ['--fv-aspect-n' as string]: aspectN,
      }}
    >
      <div
        className="fv-grid"
        style={{
          width: gridW,
          height: gridH,
          ['--fv-fit-scale' as string]: scale,
        }}
      >
        {rotated.cells.map(([c, r]) => {
          const seat = rotated.seatByKey.get(cellKey(c, r))
          const agent = seat?.agentId ? agentsById.get(seat.agentId) ?? null : null
          return (
            <div
              key={cellKey(c, r)}
              className={`fv-cell${(c + r) % 2 === 0 ? '' : ' fv-cell--alt'}`}
              style={{
                left: (c - minC) * VIEW_CELL,
                top: (r - minR) * VIEW_CELL,
                width: VIEW_CELL,
                height: VIEW_CELL,
              }}
            >
              {seat ? (
                agent ? (
                  <SpaceSeat
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
