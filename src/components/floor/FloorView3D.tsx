import { useMemo } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import {
  type Dir,
  DIV_H,
  SEAT_MAX_H,
  SEAT_MIN_H,
  TH,
  TW,
  WALL_H,
  backLeftEdge,
  backLeftVisible,
  backLeftWall,
  backRightEdge,
  backRightVisible,
  backRightWall,
  computeIsoBounds,
  depthCompare,
  diamondPoints,
  leftFace,
  leftFaceVisible,
  openingPoints,
  projectCell,
  rightFace,
  rightFaceVisible,
  slabLeftFace,
  slabRightFace,
} from '../../floor/floor-iso'
import { GRID_C, GRID_R, cellKey } from '../../floor/floor-plan-model'
import type { Cell, Edge, Floor } from '../../floor/types'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { agentInitials } from '../../utils/format'
import { colorFromString } from '../../utils/color-from-string'

export type SeatStyle = 'tower' | 'avatar' | 'cube'

const MAX_C = GRID_C - 1
const MAX_R = GRID_R - 1

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const FLOOR_FILL = 'rgb(247,246,243)'
const WALL_FILL = 'rgb(247,246,243)'

function seatHeight(agent: Agent): number {
  const ratio = agent.max > 0 ? Math.min(1, agent.used / agent.max) : 0
  return SEAT_MIN_H + ratio * (SEAT_MAX_H - SEAT_MIN_H)
}

/** Circular avatar (photo or initials) drawn in SVG, clipped to a disc.
   When showPhoto is false we always render initials, never the photo. */
function AvatarDisc({
  agent,
  cx,
  cy,
  r,
  ring,
  showPhoto,
}: {
  agent: Agent
  cx: number
  cy: number
  r: number
  ring: string
  showPhoto: boolean
}) {
  const loadedPhoto = useSalesforcePhoto(agent.photo)
  const photo = showPhoto ? loadedPhoto : null
  const clipId = `fv3d-clip-${agent.id}`
  return (
    <g>
      <clipPath id={clipId}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} fill="var(--pa-av-bg, #E9E7F0)" />
      {photo ? (
        <image
          href={photo}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 0.8}
          fontWeight={600}
          fill="var(--pa-av-fg, #514E5C)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {agentInitials(agent.name)}
        </text>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={2.5} />
    </g>
  )
}

interface IsoSeatProps {
  agent: Agent
  x: number
  y: number
  style: SeatStyle
  showAvatars: boolean
  animations: boolean
  onSelect: (agent: Agent) => void
}

const BASE_H = SEAT_MIN_H  // pedestal height matches idle agent tower height
const CAP_OPACITY = 0.60  // top face opacity
const BASE_OPACITY = 0.55 // pedestal face opacity
const SHAFT_OPACITY = 0.18 // transparent shaft body

function towerFaces(x: number, y: number, h: number, color: string) {
  // Three-section tower: opaque pedestal base + transparent shaft + opaque top cap.
  // The pedestal is drawn first (behind), then the shaft on top with low opacity so
  // the pedestal faces show through. Uses currentColor so CSS vars resolve at paint time.
  const base = Math.min(BASE_H, h)
  return (
    <g style={{ color }}>
      {/* 1. Pedestal base — drawn first so shaft is painted over it and shows through */}
      <polygon points={leftFace(x, y, 0, base)} fill="currentColor" fillOpacity={BASE_OPACITY} />
      <polygon points={leftFace(x, y, 0, base)} fill="rgba(0,0,0,0.18)" />
      <polygon points={rightFace(x, y, 0, base)} fill="currentColor" fillOpacity={BASE_OPACITY} />
      <polygon points={rightFace(x, y, 0, base)} fill="rgba(0,0,0,0.08)" />
      <polygon points={diamondPoints(x, y, base)} fill="currentColor" fillOpacity={BASE_OPACITY} />
      <polygon points={diamondPoints(x, y, base)} fill="rgba(255,255,255,0.15)" />
      {/* 2. Shaft — transparent, full height so pedestal shows through at the bottom */}
      {h > base && (
        <>
          <polygon points={leftFace(x, y, base, h)} fill="currentColor" fillOpacity={SHAFT_OPACITY} />
          <polygon points={leftFace(x, y, base, h)} fill="rgba(0,0,0,0.06)" />
          <polygon points={rightFace(x, y, base, h)} fill="currentColor" fillOpacity={SHAFT_OPACITY} />
          <polygon points={rightFace(x, y, base, h)} fill="rgba(0,0,0,0.03)" />
        </>
      )}
      {/* 3. Top cap face — opaque */}
      <polygon points={diamondPoints(x, y, h)} fill="currentColor" fillOpacity={CAP_OPACITY} />
      <polygon points={diamondPoints(x, y, h)} fill="rgba(255,255,255,0.20)" stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.5} />
    </g>
  )
}

function IsoSeat({ agent, x, y, style, showAvatars, animations, onSelect }: IsoSeatProps) {
  const status = STATUS_COLOR[agent.status]
  const saturated = agent.max > 0 && agent.used >= agent.max
  const title = `${agent.name} · ${agent.used}/${agent.max}`

  let body: React.ReactNode
  if (style === 'avatar') {
    const cy = y - SEAT_MIN_H
    body = (
      <>
        <ellipse cx={x} cy={y + TH * 0.2} rx={TW * 0.5} ry={TH * 0.5} fill="rgba(27,25,36,0.16)" />
        <AvatarDisc agent={agent} cx={x} cy={cy} r={TH * 0.95} ring={status} showPhoto={showAvatars} />
      </>
    )
  } else if (style === 'cube') {
    const h = seatHeight(agent)
    const team = colorFromString(agent.role || agent.name)
    body = (
      <>
        {towerFaces(x, y, h, team)}
        <circle cx={x} cy={y - h} r={4} style={{ fill: status }} stroke="#fff" strokeWidth={1.2} />
      </>
    )
  } else {
    // tower
    const h = seatHeight(agent)
    body = (
      <>
        {towerFaces(x, y, h, status)}
        <AvatarDisc agent={agent} cx={x} cy={y - h - TH * 0.55} r={TH * 0.85} ring={status} showPhoto={showAvatars} />
        {saturated ? (
          <>
            <line x1={x} y1={y - h} x2={x} y2={y - h - TH * 1.6} stroke="#E05641" strokeWidth={1.5} />
            <circle
              className={animations ? 'fv3d-beacon' : undefined}
              cx={x}
              cy={y - h - TH * 1.6}
              r={4.5}
              fill="#E05641"
              stroke="#fff"
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </>
    )
  }

  return (
    <g className="fv3d-seat" onClick={() => onSelect(agent)} role="button" aria-label={title}>
      <title>{title}</title>
      {body}
    </g>
  )
}

function VacantSeat({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <title>Seient lliure</title>
      <ellipse
        cx={x}
        cy={y}
        rx={TW * 0.42}
        ry={TH * 0.42}
        fill="none"
        stroke="rgba(27,25,36,.22)"
        strokeDasharray="3 3"
      />
    </g>
  )
}

interface FloorView3DProps {
  floor: Floor
  agentsById: Map<string, Agent>
  dir: Dir
  seatStyle: SeatStyle
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
}

export function FloorView3D({
  floor,
  agentsById,
  dir,
  seatStyle,
  showAvatars,
  animations,
  onSelectAgent,
}: FloorView3DProps) {
  const cellSet = useMemo(() => new Set(floor.cells.map(([c, r]) => cellKey(c, r))), [floor.cells])
  const has = useMemo(() => (c: number, r: number) => cellSet.has(cellKey(c, r)), [cellSet])

  const seatByKey = useMemo(() => {
    const map = new Map<string, Floor['seats'][number]>()
    for (const seat of floor.seats) map.set(cellKey(seat.c, seat.r), seat)
    return map
  }, [floor.seats])

  const dividersByKey = useMemo(() => {
    const map = new Map<string, Floor['dividers']>()
    for (const d of floor.dividers) {
      const key = cellKey(d.c, d.r)
      const list = map.get(key) ?? []
      list.push(d)
      map.set(key, list)
    }
    return map
  }, [floor.dividers])

  const openingByKey = useMemo(() => {
    const map = new Map<string, 'door' | 'window'>()
    for (const o of floor.openings) map.set(`${o.c},${o.r},${o.edge}`, o.kind)
    return map
  }, [floor.openings])

  const ordered = useMemo(() => [...floor.cells].sort(depthCompare(dir)), [floor.cells, dir])
  const bounds = useMemo(
    () => computeIsoBounds(floor.cells, dir, MAX_C, MAX_R, TH * 2),
    [floor.cells, dir],
  )

  const rfVis = rightFaceVisible(has, dir)
  const lfVis = leftFaceVisible(has, dir)
  const brVis = backRightVisible(has, dir)
  const blVis = backLeftVisible(has, dir)
  const brEdge = backRightEdge(dir)
  const blEdge = backLeftEdge(dir)

  const pos = (c: number, r: number): Cell => projectCell(c, r, dir, MAX_C, MAX_R) as Cell

  const shadows = floor.cells.map(([c, r]) => {
    const [x, y] = pos(c, r)
    return <polygon key={`sh-${c}-${r}`} points={diamondPoints(x, y, 0)} />
  })

  const wallOpening = (c: number, r: number, edge: Edge, g0: Cell, g1: Cell, t0: Cell, t1: Cell) => {
    const kind = openingByKey.get(`${c},${r},${edge}`)
    if (!kind) return null
    const fill = kind === 'door' ? 'rgba(110,110,115,.34)' : 'rgba(120,140,170,.36)'
    const stroke = kind === 'door' ? 'rgba(80,80,88,.20)' : 'rgba(95,120,155,.20)'
    return <polygon points={openingPoints(g0, g1, t0, t1, kind)} fill={fill} stroke={stroke} />
  }

  const body: React.ReactNode[] = []
  for (const [c, r] of ordered) {
    const [x, y] = pos(c, r)
    const key = cellKey(c, r)

    // Back walls (drawn behind the tile within this cell group).
    if (brVis(c, r)) {
      body.push(<polygon key={`wbr-${key}`} points={backRightWall(x, y)} fill={WALL_FILL} />)
      body.push(
        <polygon key={`wbr2-${key}`} points={backRightWall(x, y)} fill="rgba(27,25,36,.032)" stroke="rgba(27,25,36,.05)" strokeWidth={0.5} />,
      )
      const op = wallOpening(c, r, brEdge, [x, y - TH], [x + TW, y], [x, y - TH - WALL_H], [x + TW, y - WALL_H])
      if (op) body.push(<g key={`obr-${key}`}>{op}</g>)
    }
    if (blVis(c, r)) {
      body.push(<polygon key={`wbl-${key}`} points={backLeftWall(x, y)} fill={WALL_FILL} />)
      body.push(
        <polygon key={`wbl2-${key}`} points={backLeftWall(x, y)} fill="rgba(27,25,36,.05)" stroke="rgba(27,25,36,.06)" strokeWidth={0.5} />,
      )
      const op = wallOpening(c, r, blEdge, [x, y - TH], [x - TW, y], [x, y - TH - WALL_H], [x - TW, y - WALL_H])
      if (op) body.push(<g key={`obl-${key}`}>{op}</g>)
    }

    // Floor slab side faces (thickness) on exterior front edges.
    if (rfVis(c, r)) body.push(<polygon key={`rf-${key}`} points={slabRightFace(x, y)} fill="rgba(27,25,36,.05)" />)
    if (lfVis(c, r)) body.push(<polygon key={`lf-${key}`} points={slabLeftFace(x, y)} fill="rgba(27,25,36,.08)" />)

    // Tile top.
    body.push(<polygon key={`t-${key}`} points={diamondPoints(x, y, 0)} fill={FLOOR_FILL} />)
    body.push(
      <polygon key={`t2-${key}`} points={diamondPoints(x, y, 0)} fill="rgba(247,246,243,.4)" stroke="rgba(27,25,36,.09)" />,
    )

    // Dividers owned by this cell.
    for (const d of dividersByKey.get(key) ?? []) {
      const [nc, nr] = d.edge === 'E' ? [c + 1, r] : [c, r + 1]
      const [bx, by] = pos(nc, nr)
      const mx = (x + bx) / 2
      const my = (y + by) / 2
      const dvx = bx - x
      const dvy = by - y
      const px = (-dvy * (TW / TH)) / 2
      const py = (dvx * (TH / TW)) / 2
      const g0: Cell = [mx + px, my + py]
      const g1: Cell = [mx - px, my - py]
      const points = `${g0[0]},${g0[1]} ${g1[0]},${g1[1]} ${g1[0]},${g1[1] - DIV_H} ${g0[0]},${g0[1] - DIV_H}`
      body.push(
        <polygon
          key={`dv-${key}-${d.edge}`}
          points={points}
          fill="rgba(47,158,143,.30)"
          stroke="rgba(47,158,143,.75)"
          strokeWidth={1.2}
        />,
      )
    }

    // Seat.
    const seat = seatByKey.get(key)
    if (seat) {
      const agent = seat.agentId ? agentsById.get(seat.agentId) ?? null : null
      if (agent) {
        body.push(
          <IsoSeat
            key={`s-${key}`}
            agent={agent}
            x={x}
            y={y}
            style={seatStyle}
            showAvatars={showAvatars}
            animations={animations}
            onSelect={onSelectAgent}
          />,
        )
      } else {
        body.push(<VacantSeat key={`s-${key}`} x={x} y={y} />)
      }
    }
  }

  return (
    <svg
      className="fv3d-svg"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="fv3d-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <g filter="url(#fv3d-shadow)" fill="rgba(27,25,36,.10)">
        {shadows}
      </g>
      {body}
    </svg>
  )
}
