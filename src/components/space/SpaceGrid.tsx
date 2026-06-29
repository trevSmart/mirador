import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { CELL_SIZE, edgeStyle } from '../../space/space-geometry'
import { GRID_C, GRID_R, cellKey } from '../../space/space-plan-model'
import type { Cell, Edge, Space, SpaceTool } from '../../space/types'
import type { SeatRef } from '../../space/useSpacePlan'
import { colorFromString } from '../../utils/color-from-string'
import { AgentAvatar } from '../AgentRow'

/** How close (fraction of a cell) to a border counts as an edge hit. */
const EDGE_MARGIN = 0.26

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const EDGE_TOOLS: ReadonlySet<SpaceTool> = new Set<SpaceTool>(['door', 'window', 'divider'])

interface SpaceGridProps {
  space: Space
  tool: SpaceTool
  selectedSeat: SeatRef | null
  agentsById: Map<string, Agent>
  onPaintCells: (start: Cell, end: Cell) => void
  onEraseCell: (c: number, r: number) => void
  onSeatTap: (c: number, r: number) => void
  onEdgeTap: (c: number, r: number, edge: Edge) => void
}

interface PointerCell {
  c: number
  r: number
  fx: number
  fy: number
}

type Session =
  | { mode: 'rect'; start: Cell }
  | { mode: 'erase'; touched: Set<string> }
  | null

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Closest edge if the pointer sits within EDGE_MARGIN of a border, else null. */
function nearestEdge(fx: number, fy: number): Edge | null {
  const dists: Array<[Edge, number]> = [
    ['N', fy],
    ['S', 1 - fy],
    ['O', fx],
    ['E', 1 - fx],
  ]
  dists.sort((a, b) => a[1] - b[1])
  return dists[0][1] <= EDGE_MARGIN ? dists[0][0] : null
}

interface SeatMarkerProps {
  agent: Agent | null
  selected: boolean
}

function SeatMarker({ agent, selected }: SeatMarkerProps) {
  const seatBorderColor = agent ? colorFromString(agent.id) : 'var(--border-strong)'
  const className = [
    'fe-seat',
    selected ? 'fe-seat--selected' : '',
    agent ? '' : 'fe-seat--empty',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={{ borderColor: seatBorderColor }} title={agent ? agent.name : 'Seient buit'}>
      {agent ? (
        <>
          <AgentAvatar id={agent.id} name={agent.name} photo={agent.photo} />
          <span className="fe-seat__status" style={{ background: STATUS_COLOR[agent.status] }} />
        </>
      ) : (
        <span className="fe-seat__empty-dot" />
      )}
    </div>
  )
}

export function SpaceGrid({
  space,
  tool,
  selectedSeat,
  agentsById,
  onPaintCells,
  onEraseCell,
  onSeatTap,
  onEdgeTap,
}: SpaceGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const session = useRef<Session>(null)
  const [preview, setPreview] = useState<{ start: Cell; end: Cell } | null>(null)

  const width = GRID_C * CELL_SIZE
  const height = GRID_R * CELL_SIZE

  const seatByKey = useMemo(() => {
    const map = new Map<string, Space['seats'][number]>()
    for (const seat of space.seats) map.set(cellKey(seat.c, seat.r), seat)
    return map
  }, [space.seats])

  // Grid drawn as discrete SVG lines rather than a repeating-linear-gradient: a
  // gradient accumulates sub-pixel error per repeat when the canvas is scaled
  // (browser zoom, DPR), making whole lines vanish periodically. Individual
  // lines each snap on their own, so none disappears.
  const gridLines = useMemo(() => {
    const lines: ReactNode[] = []
    for (let c = 0; c <= GRID_C; c++) {
      const x = c * CELL_SIZE
      lines.push(<line key={`v${c}`} x1={x} y1={0} x2={x} y2={height} />)
    }
    for (let r = 0; r <= GRID_R; r++) {
      const y = r * CELL_SIZE
      lines.push(<line key={`h${r}`} x1={0} y1={y} x2={width} y2={y} />)
    }
    return lines
  }, [width, height])

  function pointerCell(event: ReactPointerEvent<HTMLDivElement>): PointerCell {
    const rect = ref.current?.getBoundingClientRect()
    const x = event.clientX - (rect?.left ?? 0)
    const y = event.clientY - (rect?.top ?? 0)
    const cf = x / CELL_SIZE
    const rf = y / CELL_SIZE
    const c = clamp(Math.floor(cf), 0, GRID_C - 1)
    const r = clamp(Math.floor(rf), 0, GRID_R - 1)
    return { c, r, fx: cf - c, fy: rf - r }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const { c, r, fx, fy } = pointerCell(event)
    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'cell') {
      session.current = { mode: 'rect', start: [c, r] }
      setPreview({ start: [c, r], end: [c, r] })
      return
    }

    if (tool === 'seat') {
      onSeatTap(c, r)
      return
    }

    const edge = nearestEdge(fx, fy)
    if (tool === 'erase') {
      if (edge) {
        onEdgeTap(c, r, edge)
      } else {
        onEraseCell(c, r)
        session.current = { mode: 'erase', touched: new Set([cellKey(c, r)]) }
      }
      return
    }

    if (EDGE_TOOLS.has(tool) && edge) {
      onEdgeTap(c, r, edge)
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = session.current
    if (!active) return
    const { c, r } = pointerCell(event)
    if (active.mode === 'rect') {
      setPreview({ start: active.start, end: [c, r] })
    } else if (active.mode === 'erase') {
      const key = cellKey(c, r)
      if (!active.touched.has(key)) {
        active.touched.add(key)
        onEraseCell(c, r)
      }
    }
  }

  function endSession(event: ReactPointerEvent<HTMLDivElement>) {
    const active = session.current
    if (active?.mode === 'rect' && preview) {
      onPaintCells(preview.start, preview.end)
    }
    session.current = null
    setPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const previewStyle = preview
    ? {
        left: Math.min(preview.start[0], preview.end[0]) * CELL_SIZE,
        top: Math.min(preview.start[1], preview.end[1]) * CELL_SIZE,
        width: (Math.abs(preview.end[0] - preview.start[0]) + 1) * CELL_SIZE,
        height: (Math.abs(preview.end[1] - preview.start[1]) + 1) * CELL_SIZE,
      }
    : null

  return (
    <div
      ref={ref}
      className="fe-grid"
      data-tool={tool}
      style={{ width, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSession}
      onPointerCancel={endSession}
    >
      <svg className="fe-grid__lines" width={width} height={height} aria-hidden="true">
        {gridLines}
      </svg>

      {space.cells.map(([c, r]) => {
        const seat = seatByKey.get(cellKey(c, r))
        const agent = seat?.agentId ? agentsById.get(seat.agentId) ?? null : null
        const isSelected = !!selectedSeat && selectedSeat.c === c && selectedSeat.r === r
        return (
          <div
            key={cellKey(c, r)}
            className="fe-cell"
            style={{ left: c * CELL_SIZE, top: r * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
          >
            {seat ? <SeatMarker agent={agent} selected={isSelected} /> : null}
          </div>
        )
      })}

      {space.dividers.map((d) => (
        <div
          key={`div-${d.c}-${d.r}-${d.edge}`}
          className="fe-edge fe-edge--divider"
          style={edgeStyle(d.c, d.r, d.edge)}
        />
      ))}

      {space.openings.map((o) => (
        <div
          key={`op-${o.c}-${o.r}-${o.edge}`}
          className={`fe-edge fe-edge--${o.kind}`}
          style={edgeStyle(o.c, o.r, o.edge)}
        />
      ))}

      {previewStyle ? <div className="fe-rect-preview" style={previewStyle} /> : null}
    </div>
  )
}
