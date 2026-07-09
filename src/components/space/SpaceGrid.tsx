import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { CELL_SIZE, edgeStyle } from '../../space/space-geometry'
import { GRID_C, GRID_R, cellKey } from '../../space/space-plan-model'
import type { MovableRef, ResolvedEdit } from '../../space/space-plan-model'
import type { Cell, Edge, Space, SpaceTool } from '../../space/types'
import type { SeatRef } from '../../space/useSpacePlan'
import { colorFromRecordId } from '../../utils/color-from-string'
import { AgentAvatar } from '../AgentRow'
import { useAltKey } from './useAltKey'

/** How close (fraction of a cell) to a border counts as an edge hit. The wide
    band applies to the edge tools and while erasing/moving, where hitting a
    specific wall must be forgiving. */
const EDGE_MARGIN = 0.28
const EDGE_MARGIN_WIDE = 0.42

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
  onEraseCellRect: (start: Cell, end: Cell) => void
  onSeatTap: (c: number, r: number) => void
  onEdgeTap: (c: number, r: number, edge: Edge) => void
  onEraseEdge: (c: number, r: number, edge: Edge) => void
  resolveAt: (c: number, r: number, edge: Edge | null, erasing: boolean) => ResolvedEdit
  rectBlockedAt: (start: Cell, end: Cell, erasing: boolean) => boolean
  elementAtRef: (c: number, r: number, edge: Edge | null) => MovableRef | null
  canDropAt: (ref: MovableRef, c: number, r: number, edge: Edge | null) => boolean
  onMove: (ref: MovableRef, to: Cell, toEdge: Edge | null) => void
}

interface PointerCell {
  c: number
  r: number
  fx: number
  fy: number
}

type Session =
  | { mode: 'rect'; start: Cell; erasing: boolean }
  | { mode: 'move'; ref: MovableRef }
  | null

/** What the cursor is telling the user right now (rendered as the ghost):
    an anticipated edit, a grabbable element under the Move tool, or the
    drop target of an in-flight move. */
type Hover =
  | { kind: 'edit'; edit: ResolvedEdit }
  | { kind: 'grab'; ref: MovableRef }
  | { kind: 'drop'; ref: MovableRef; c: number; r: number; edge: Edge | null; valid: boolean }
  | null

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Closest edge if the pointer sits within `margin` of a border, else null. */
function nearestEdge(fx: number, fy: number, margin = EDGE_MARGIN): Edge | null {
  const dists: Array<[Edge, number]> = [
    ['N', fy],
    ['S', 1 - fy],
    ['O', fx],
    ['E', 1 - fx],
  ]
  dists.sort((a, b) => a[1] - b[1])
  return dists[0][1] <= margin ? dists[0][0] : null
}

/** Track the Alt key globally: held with any tool it turns the gesture into a
    momentary erase, so quick corrections never require switching tools. */
interface SeatMarkerProps {
  agent: Agent | null
  selected: boolean
}

function SeatMarker({ agent, selected }: SeatMarkerProps) {
  const seatBorderColor = agent ? colorFromRecordId(agent.id) : 'var(--border-strong)'
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
  onEraseCellRect,
  onSeatTap,
  onEdgeTap,
  onEraseEdge,
  resolveAt,
  rectBlockedAt,
  elementAtRef,
  canDropAt,
  onMove,
}: SpaceGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const session = useRef<Session>(null)
  const [preview, setPreview] = useState<{ start: Cell; end: Cell; erasing: boolean; blocked: boolean } | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  // Mirrors the move session's lifted element so the render can hide the
  // origin (session lives in a ref and can't trigger a re-render itself).
  const [moving, setMoving] = useState<MovableRef | null>(null)

  const alt = useAltKey()
  const erasing = tool === 'erase' || alt

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

  /** Wide edge detection for the edge tools, the Move tool and while erasing. */
  function pointerEdge(fx: number, fy: number): Edge | null {
    const wide = EDGE_TOOLS.has(tool) || tool === 'move' || erasing
    return nearestEdge(fx, fy, wide ? EDGE_MARGIN_WIDE : EDGE_MARGIN)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const { c, r, fx, fy } = pointerCell(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    const edge = pointerEdge(fx, fy)
    setHover(null)

    // ERASING (erase tool or Alt): edge erase is a single precise hit; anything
    // else starts a rectangle-erase drag. A lone click stays a precise erase
    // (handled on release in endSession).
    if (erasing) {
      const hit = resolveAt(c, r, edge, true)
      if (hit.target === 'edge' && hit.edge && hit.intent === 'erase') {
        onEraseEdge(c, r, hit.edge)
        return
      }
      session.current = { mode: 'rect', start: [c, r], erasing: true }
      setPreview({ start: [c, r], end: [c, r], erasing: true, blocked: rectBlockedAt([c, r], [c, r], true) })
      return
    }

    // MOVE: lift the element under the cursor, if any. The drop ghost shows
    // immediately, without waiting for the first pointermove.
    if (tool === 'move') {
      const grabbed = elementAtRef(c, r, edge)
      if (grabbed) {
        session.current = { mode: 'move', ref: grabbed }
        setMoving(grabbed)
        const dropEdge = grabbed.kind === 'seat' ? null : edge
        setHover({ kind: 'drop', ref: grabbed, c, r, edge: dropEdge, valid: canDropAt(grabbed, c, r, dropEdge) })
      }
      return
    }

    // BUILD: Area drags a rectangle to paint.
    if (tool === 'cell') {
      session.current = { mode: 'rect', start: [c, r], erasing: false }
      setPreview({ start: [c, r], end: [c, r], erasing: false, blocked: rectBlockedAt([c, r], [c, r], false) })
      return
    }

    if (tool === 'seat') {
      onSeatTap(c, r)
      return
    }

    if (EDGE_TOOLS.has(tool) && edge) {
      onEdgeTap(c, r, edge)
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const { c, r, fx, fy } = pointerCell(event)
    const active = session.current

    if (!active) {
      const edge = pointerEdge(fx, fy)
      if (tool === 'move' && !erasing) {
        const grabbable = elementAtRef(c, r, edge)
        setHover(grabbable ? { kind: 'grab', ref: grabbable } : null)
        return
      }
      setHover({ kind: 'edit', edit: resolveAt(c, r, edge, erasing) })
      return
    }

    if (active.mode === 'rect') {
      setPreview({
        start: active.start,
        end: [c, r],
        erasing: active.erasing,
        blocked: rectBlockedAt(active.start, [c, r], active.erasing),
      })
      return
    }

    // Move drag: preview the drop target (blue = valid, red = invalid).
    const edge = active.ref.kind === 'seat' ? null : pointerEdge(fx, fy)
    setHover({
      kind: 'drop',
      ref: active.ref,
      c,
      r,
      edge,
      valid: canDropAt(active.ref, c, r, edge),
    })
  }

  function endSession(event: ReactPointerEvent<HTMLDivElement>) {
    const active = session.current
    // A cancelled pointer (browser took the gesture) discards, never commits.
    const commit = event.type !== 'pointercancel'
    if (commit && active?.mode === 'rect' && preview) {
      const single =
        preview.start[0] === preview.end[0] && preview.start[1] === preview.end[1]
      if (active.erasing) {
        // lone click → precise two-step erase (agent first, then desk);
        // real drag → bulk rectangle erase (both reject island-splitting)
        if (single) onEraseCell(preview.start[0], preview.start[1])
        else onEraseCellRect(preview.start, preview.end)
      } else {
        onPaintCells(preview.start, preview.end)
      }
    }
    if (active?.mode === 'move') {
      if (commit && hover?.kind === 'drop' && hover.valid) {
        onMove(active.ref, [hover.c, hover.r], hover.edge)
      }
      setMoving(null)
    }
    session.current = null
    setPreview(null)
    setHover(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handlePointerLeave() {
    if (!session.current) setHover(null)
  }

  const previewStyle = preview
    ? {
        left: Math.min(preview.start[0], preview.end[0]) * CELL_SIZE,
        top: Math.min(preview.start[1], preview.end[1]) * CELL_SIZE,
        width: (Math.abs(preview.end[0] - preview.start[0]) + 1) * CELL_SIZE,
        height: (Math.abs(preview.end[1] - preview.start[1]) + 1) * CELL_SIZE,
      }
    : null

  const cellStyle = (c: number, r: number) => ({
    left: c * CELL_SIZE,
    top: r * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  })

  /** Circle centred in the cell, for seat-shaped ghosts. */
  const seatGhostStyle = (c: number, r: number, size: number) => ({
    left: c * CELL_SIZE + (CELL_SIZE - size) / 2,
    top: r * CELL_SIZE + (CELL_SIZE - size) / 2,
    width: size,
    height: size,
  })

  /** The ghost under the cursor — anticipates what the click/drop will do.
      Three states, always visible: build (blue), erase (red), noop (grey). */
  let ghost: ReactNode = null
  if (hover?.kind === 'edit') {
    const { edit } = hover
    const style = edit.target === 'edge' && edit.edge
      ? edgeStyle(edit.c, edit.r, edit.edge)
      : cellStyle(edit.c, edit.r)
    ghost = <div className={`fe-ghost fe-ghost--${edit.target} fe-ghost--${edit.intent}`} style={style} />
  } else if (hover?.kind === 'grab') {
    const { ref: g } = hover
    const style = g.kind === 'seat' ? seatGhostStyle(g.c, g.r, 36) : edgeStyle(g.c, g.r, g.edge)
    ghost = <div className={`fe-ghost fe-ghost--grab${g.kind === 'seat' ? ' fe-ghost--grab-seat' : ''}`} style={style} />
  } else if (hover?.kind === 'drop') {
    if (hover.ref.kind === 'seat') {
      // Valid: the carried seat previewed at its landing cell (neutral dashed
      // circle, like the seat in hand); invalid: red-hatched cell.
      ghost = hover.valid ? (
        <div className="fe-ghost fe-ghost--move-seat" style={seatGhostStyle(hover.c, hover.r, 32)} />
      ) : (
        <div className="fe-ghost fe-ghost--seat fe-ghost--block" style={cellStyle(hover.c, hover.r)} />
      )
    } else {
      const style = hover.edge ? edgeStyle(hover.c, hover.r, hover.edge) : cellStyle(hover.c, hover.r)
      ghost = (
        <div className={`fe-ghost fe-ghost--edge fe-ghost--${hover.valid ? 'build' : 'block'}`} style={style} />
      )
    }
  }

  /** While a move drag is live, the origin element hides as if picked up. */
  const isMovingSeat = (c: number, r: number) =>
    moving?.kind === 'seat' && moving.c === c && moving.r === r
  const isMovingEdge = (kind: 'opening' | 'divider', c: number, r: number, edge: Edge) =>
    moving?.kind === kind && moving.c === c && moving.r === r && moving.edge === edge

  return (
    <div
      ref={ref}
      className="fe-grid"
      data-tool={tool}
      data-erasing={erasing}
      style={{ width, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
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
          <div key={cellKey(c, r)} className="fe-cell" style={cellStyle(c, r)}>
            {seat && !isMovingSeat(c, r) ? <SeatMarker agent={agent} selected={isSelected} /> : null}
          </div>
        )
      })}

      {space.dividers.map((d) =>
        isMovingEdge('divider', d.c, d.r, d.edge) ? null : (
          <div
            key={`div-${d.c}-${d.r}-${d.edge}`}
            className="fe-edge fe-edge--divider"
            style={edgeStyle(d.c, d.r, d.edge)}
          />
        ),
      )}

      {space.openings.map((o) =>
        isMovingEdge('opening', o.c, o.r, o.edge) ? null : (
          <div
            key={`op-${o.c}-${o.r}-${o.edge}`}
            className={`fe-edge fe-edge--${o.kind}`}
            style={edgeStyle(o.c, o.r, o.edge)}
          />
        ),
      )}

      {ghost}
      {previewStyle && preview ? (
        <div
          className={[
            'fe-rect-preview',
            preview.erasing ? 'fe-rect-preview--erasing' : '',
            preview.blocked ? 'fe-rect-preview--blocked' : '',
          ].filter(Boolean).join(' ')}
          style={previewStyle}
        />
      ) : null}
    </div>
  )
}
