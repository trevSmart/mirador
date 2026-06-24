import { useCallback, useMemo, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { FloorSeatTooltip } from './FloorSeatTooltip'
import { useTowerHeightScale } from '../../hooks/useTowerHeightScale'
import type { Agent, Queue } from '../../api/types'
import { agentTowerSegments, towerSegmentLabel, type TowerSegment } from '../../floor/agent-tower-segments'
import {
  type Dir,
  DIV_H,
  SEAT_MAX_H,
  SEAT_MIN_H,
  TH,
  TW,
  WALL_H,
  backLeftEdge,
  backLeftTrue,
  backLeftWall,
  backRightEdge,
  backRightTrue,
  backRightWall,
  computeIsoBounds,
  depthCompare,
  diamondPoints,
  leftFace,
  leftFaceVisible,
  openingQuad,
  openingQuadPoints,
  type OpeningQuad,
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

export type SeatStyle = 'tower' | 'avatar' | 'cube'

const MAX_C = GRID_C - 1
const MAX_R = GRID_R - 1

const PEDESTAL_COLOR = 'var(--text-disabled)'
const AVATAR_RING = 'var(--border-subtle)'

const FLOOR_FILL_A = '#F8F7F4'
const FLOOR_FILL_B = '#F5F4F1'
const WALL_FILL = 'rgb(247,246,243)'

function lerpPt(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Parametric point inside an opening quad (u = left→right, v = bottom→top). */
function quadAt(quad: OpeningQuad, u: number, v: number): [number, number] {
  return lerpPt(lerpPt(quad.bl, quad.br, u), lerpPt(quad.tl, quad.tr, u), v)
}

function quadSlice(quad: OpeningQuad, u0: number, u1: number, v0: number, v1: number): OpeningQuad {
  return {
    bl: quadAt(quad, u0, v0),
    br: quadAt(quad, u1, v0),
    tr: quadAt(quad, u1, v1),
    tl: quadAt(quad, u0, v1),
  }
}

/** Glass pane with pixel-art gradient + hard-edged reflection bands. */
function WindowGlass({ id, quad }: { id: string; quad: OpeningQuad }) {
  const { bl, tl, tr } = quad
  const gradId = `${id}-glass`
  const pane = openingQuadPoints(quad)
  const sill = openingQuadPoints(quadSlice(quad, 0, 1, 0, 0.1))
  const reflect = openingQuadPoints(quadSlice(quad, 0.06, 0.24, 0.38, 0.94))
  const glint = openingQuadPoints(quadSlice(quad, 0.58, 0.8, 0.74, 0.94))

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1={tl[0]} y1={tl[1]} x2={bl[0]} y2={bl[1]} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(196, 228, 248, 0.44)" />
          <stop offset="55%" stopColor="rgba(118, 172, 215, 0.34)" />
          <stop offset="100%" stopColor="rgba(62, 108, 152, 0.28)" />
        </linearGradient>
      </defs>
      <polygon points={pane} fill={`url(#${gradId})`} />
      <polygon points={sill} fill="rgba(38, 68, 98, 0.14)" />
      <polygon points={reflect} fill="rgba(236, 248, 255, 0.38)" />
      <polygon points={glint} fill="rgba(255, 255, 255, 0.28)" />
      <polygon
        points={pane}
        fill="none"
        stroke="rgba(48, 88, 128, 0.38)"
        strokeWidth={0.65}
        strokeLinejoin="miter"
      />
      <line
        x1={lerpPt(tl, tr, 0.04)[0]}
        y1={lerpPt(tl, tr, 0.04)[1]}
        x2={lerpPt(tl, tr, 0.96)[0]}
        y2={lerpPt(tl, tr, 0.96)[1]}
        stroke="rgba(48, 88, 128, 0.22)"
        strokeWidth={0.5}
      />
    </g>
  )
}

/** Door panel with the same pixel-art layered treatment (warm wood tones). */
function DoorPanel({ id, quad }: { id: string; quad: OpeningQuad }) {
  const { bl, tl, tr, br } = quad
  const gradId = `${id}-door`
  const pane = openingQuadPoints(quad)
  const threshold = openingQuadPoints(quadSlice(quad, 0, 1, 0, 0.12))
  const reflect = openingQuadPoints(quadSlice(quad, 0.07, 0.25, 0.32, 0.92))
  const glint = openingQuadPoints(quadSlice(quad, 0.6, 0.82, 0.7, 0.9))
  const panelLineY = 0.56

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1={tl[0]} y1={tl[1]} x2={bl[0]} y2={bl[1]} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(228, 218, 200, 0.52)" />
          <stop offset="55%" stopColor="rgba(178, 158, 132, 0.42)" />
          <stop offset="100%" stopColor="rgba(118, 98, 78, 0.36)" />
        </linearGradient>
      </defs>
      <polygon points={pane} fill={`url(#${gradId})`} />
      <polygon points={threshold} fill="rgba(68, 54, 42, 0.16)" />
      <polygon points={reflect} fill="rgba(255, 246, 232, 0.34)" />
      <polygon points={glint} fill="rgba(255, 255, 248, 0.24)" />
      <polygon
        points={pane}
        fill="none"
        stroke="rgba(88, 72, 58, 0.4)"
        strokeWidth={0.65}
        strokeLinejoin="miter"
      />
      <line
        x1={lerpPt(tl, tr, 0.04)[0]}
        y1={lerpPt(tl, tr, 0.04)[1]}
        x2={lerpPt(tl, tr, 0.96)[0]}
        y2={lerpPt(tl, tr, 0.96)[1]}
        stroke="rgba(88, 72, 58, 0.24)"
        strokeWidth={0.5}
      />
      <line
        x1={quadAt(quad, 0.06, panelLineY)[0]}
        y1={quadAt(quad, 0.06, panelLineY)[1]}
        x2={quadAt(quad, 0.94, panelLineY)[0]}
        y2={quadAt(quad, 0.94, panelLineY)[1]}
        stroke="rgba(88, 72, 58, 0.2)"
        strokeWidth={0.5}
      />
      <circle
        cx={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[0]}
        cy={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[1]}
        r={1.4}
        fill="rgba(168, 148, 118, 0.75)"
        stroke="rgba(88, 72, 58, 0.35)"
        strokeWidth={0.4}
      />
    </g>
  )
}

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
  clipPrefix,
}: {
  agent: Agent
  cx: number
  cy: number
  r: number
  ring: string
  showPhoto: boolean
  clipPrefix: string
}) {
  const loadedPhoto = useSalesforcePhoto(agent.photo)
  const photo = showPhoto ? loadedPhoto : null
  const clipId = `${clipPrefix}-clip-${agent.id}`
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
  queuesById: Map<string, Queue>
  onSelect: (agent: Agent) => void
  onPointerOver: (agent: Agent, event: ReactPointerEvent<SVGGElement>) => void
  onPointerMove: (agent: Agent, event: ReactPointerEvent<SVGGElement>) => void
  onPointerOut: () => void
  clipPrefix: string
}

// Base and cap are solid, outlined slabs with real thickness — they frame the
// translucent shaft between them (the panorama capsule look).
const BAND_H = 4.5
const BAND_OPACITY = 0.68

// Glassy tower face: the colour stays the queue hue but fades to translucent
// toward the top, giving the whole shaft a vertical "rising glass" gradient.
const FACE_OPACITY_BOTTOM = 0.6
const FACE_OPACITY_TOP = 0.22

// Lit (right) vs. shaded (left) faces keep a faint dark wash for iso depth.
const SHADE_LEFT = 'rgba(12,10,22,0.12)'
const SHADE_RIGHT = 'rgba(12,10,22,0.04)'

// Stronger hue outline that rings the base and cap bands.
const BAND_STROKE_OPACITY = 0.55
const BAND_STROKE_WIDTH = 0.85

/** Vertical colour gradient spanning the FULL tower height, so each stacked
   segment exposes the slice of the fade that matches its own elevation.
   Uses currentColor so it inherits the segment's queue hue. */
function TowerFaceGradient({ id, x, y, h }: { id: string; x: number; y: number; h: number }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x} y2={y - h}>
      <stop offset="0%" stopColor="currentColor" stopOpacity={FACE_OPACITY_BOTTOM} />
      <stop offset="100%" stopColor="currentColor" stopOpacity={FACE_OPACITY_TOP} />
    </linearGradient>
  )
}

/** A solid slab band (base or cap) with real thickness: two side faces + a top
   diamond, all opaque and ringed with a stronger-hue outline. */
function bandFaces(x: number, y: number, h1: number, h2: number, color: string) {
  return (
    <g style={{ color }}>
      <polygon
        points={leftFace(x, y, h1, h2)}
        fill="currentColor"
        fillOpacity={BAND_OPACITY}
        stroke="currentColor"
        strokeOpacity={BAND_STROKE_OPACITY}
        strokeWidth={BAND_STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <polygon className="fv3d-noedge" points={leftFace(x, y, h1, h2)} fill={SHADE_LEFT} />
      <polygon
        points={rightFace(x, y, h1, h2)}
        fill="currentColor"
        fillOpacity={BAND_OPACITY}
        stroke="currentColor"
        strokeOpacity={BAND_STROKE_OPACITY}
        strokeWidth={BAND_STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <polygon className="fv3d-noedge" points={rightFace(x, y, h1, h2)} fill={SHADE_RIGHT} />
      <polygon
        points={diamondPoints(x, y, h2)}
        fill="currentColor"
        fillOpacity={BAND_OPACITY}
        stroke="currentColor"
        strokeOpacity={BAND_STROKE_OPACITY}
        strokeWidth={BAND_STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <polygon className="fv3d-noedge" points={diamondPoints(x, y, h2)} fill="rgba(255,255,255,0.12)" />
    </g>
  )
}

/** A glassy shaft segment: just the two side faces, painted with the vertical
   colour gradient (no top — the cap band covers the shaft). */
function shaftSegmentFaces(x: number, y: number, h1: number, h2: number, h: number, color: string, gradId: string) {
  const fill = `url(#${gradId})`
  return (
    <g style={{ color }}>
      <defs>
        <TowerFaceGradient id={gradId} x={x} y={y} h={h} />
      </defs>
      <polygon points={leftFace(x, y, h1, h2)} fill={fill} />
      <polygon className="fv3d-noedge" points={leftFace(x, y, h1, h2)} fill={SHADE_LEFT} />
      <polygon points={rightFace(x, y, h1, h2)} fill={fill} />
      <polygon className="fv3d-noedge" points={rightFace(x, y, h1, h2)} fill={SHADE_RIGHT} />
    </g>
  )
}

function segmentedTowerFaces(x: number, y: number, h: number, segments: TowerSegment[], idBase: string) {
  const base = Math.min(BAND_H, h)
  const capH = Math.min(BAND_H, Math.max(0, h - base))
  const shaftTop = h - capH
  const shaftH = Math.max(0, shaftTop - base)
  const topColor = segments[segments.length - 1]?.color ?? PEDESTAL_COLOR

  let cursor = base
  const parts: ReactNode[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const top = cursor + shaftH * seg.fraction
    parts.push(
      <g key={`${seg.queueId ?? 'unknown'}-${i}`}>
        {shaftSegmentFaces(x, y, cursor, top, h, seg.color, `${idBase}-sg${i}`)}
      </g>,
    )
    cursor = top
  }

  if (segments.length === 0 && shaftH > 0) {
    parts.push(
      <g key="shaft-fallback">{shaftSegmentFaces(x, y, base, shaftTop, h, PEDESTAL_COLOR, `${idBase}-sgf`)}</g>,
    )
  }

  return (
    <>
      <g key="pedestal">{bandFaces(x, y, 0, base, PEDESTAL_COLOR)}</g>
      {parts}
      {capH > 0 ? <g key="cap">{bandFaces(x, y, shaftTop, h, topColor)}</g> : null}
    </>
  )
}

function towerTitle(agent: Agent, queuesById: Map<string, Queue>): string {
  const segments = agentTowerSegments(agent, queuesById)
  const load = `${agent.used}/${agent.max}`
  if (segments.length === 0) return `${agent.name} · ${load}`
  const breakdown = segments
    .map((seg) => `${towerSegmentLabel(seg, queuesById)} ${seg.count}`)
    .join(', ')
  return `${agent.name} · ${load} · ${breakdown}`
}

function IsoSeat({
  agent,
  x,
  y,
  style,
  showAvatars,
  animations,
  queuesById,
  onSelect,
  onPointerOver,
  onPointerMove,
  onPointerOut,
  clipPrefix,
}: IsoSeatProps) {
  const saturated = agent.max > 0 && agent.used >= agent.max
  const ratio = agent.max > 0 ? Math.min(1, agent.used / agent.max) : 0
  const segments = agentTowerSegments(agent, queuesById)
  const title = towerTitle(agent, queuesById)
  const topColor = segments[segments.length - 1]?.color ?? PEDESTAL_COLOR
  const targetH = style === 'avatar' ? SEAT_MIN_H : seatHeight(agent)
  const h = useTowerHeightScale(targetH, style !== 'avatar')
  const idBase = `${clipPrefix}-${agent.id}`

  // Soft colour aura at the foot of the tower; its strength tracks the load,
  // so busier agents quietly glow brighter.
  const glow =
    ratio > 0.04 ? (
      <ellipse
        key="glow"
        cx={x}
        cy={y}
        rx={TW * 0.92}
        ry={TH * 0.92}
        style={{ fill: topColor }}
        opacity={0.16 + ratio * 0.34}
        filter={`url(#${clipPrefix}-glow)`}
      />
    ) : null

  let body: ReactNode
  if (style === 'avatar') {
    const cy = y - SEAT_MIN_H
    body = (
      <>
        <ellipse key="shadow" cx={x} cy={y + TH * 0.2} rx={TW * 0.5} ry={TH * 0.5} fill="rgba(27,25,36,0.16)" />
        <AvatarDisc key="avatar" agent={agent} cx={x} cy={cy} r={TH * 0.95} ring={AVATAR_RING} showPhoto={showAvatars} clipPrefix={clipPrefix} />
      </>
    )
  } else if (style === 'cube') {
    body = (
      <>
        {glow}
        <g key="tower">{segmentedTowerFaces(x, y, h, segments, idBase)}</g>
        <circle key="cap-dot" cx={x} cy={y - h} r={4} style={{ fill: topColor }} stroke="#fff" strokeWidth={1.2} />
      </>
    )
  } else {
    body = (
      <>
        {glow}
        <g key="tower">{segmentedTowerFaces(x, y, h, segments, idBase)}</g>
        {showAvatars ? (
          <AvatarDisc
            key="avatar"
            agent={agent}
            cx={x}
            cy={y - h - TH * 0.62}
            r={TH * 1.05}
            ring={AVATAR_RING}
            showPhoto
            clipPrefix={clipPrefix}
          />
        ) : null}
        {saturated ? (
          <>
            <line key="beacon-stem" x1={x} y1={y - h} x2={x} y2={y - h - TH * 1.6} stroke="#E05641" strokeWidth={1.5} />
            <circle
              key="beacon"
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
    <g
      className="fv3d-seat"
      onClick={() => onSelect(agent)}
      onPointerOver={(event) => onPointerOver(agent, event)}
      onPointerMove={(event) => onPointerMove(agent, event)}
      onPointerOut={onPointerOut}
      role="button"
      aria-label={title}
    >
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
  queuesById: Map<string, Queue>
  dir: Dir
  seatStyle: SeatStyle
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
}

export function FloorView3D({
  floor,
  agentsById,
  queuesById,
  dir,
  seatStyle,
  showAvatars,
  animations,
  onSelectAgent,
}: FloorView3DProps) {
  const [tooltip, setTooltip] = useState<{ agent: Agent; x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const tipAt = useCallback((agent: Agent, clientX: number, clientY: number) => {
    setTooltip({
      agent,
      x: clientX + 14,
      y: clientY + 14,
    })
    setTooltipOpen(true)
  }, [])

  const handleSeatOver = useCallback(
    (agent: Agent, event: ReactPointerEvent<SVGGElement>) => {
      tipAt(agent, event.clientX, event.clientY)
    },
    [tipAt],
  )

  const handleSeatMove = useCallback(
    (agent: Agent, event: ReactPointerEvent<SVGGElement>) => {
      tipAt(agent, event.clientX, event.clientY)
    },
    [tipAt],
  )

  const handleSeatOut = useCallback(() => setTooltipOpen(false), [])

  const handleTooltipExited = useCallback(() => setTooltip(null), [])

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
  const svgIdPrefix = `fv3d-${floor.id}`
  const floorGrainId = `${svgIdPrefix}-floor-grain`
  const floorSheenId = `${svgIdPrefix}-floor-sheen`
  const bounds = useMemo(
    () => computeIsoBounds(floor.cells, dir, MAX_C, MAX_R, TH * 2),
    [floor.cells, dir],
  )

  const rfVis = rightFaceVisible(has, dir)
  const lfVis = leftFaceVisible(has, dir)
  const brVis = backRightTrue(has, floor.cells, dir, MAX_C, MAX_R)
  const blVis = backLeftTrue(has, floor.cells, dir, MAX_C, MAX_R)
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
    if (kind === 'window') {
      const quad = openingQuad(g0, g1, t0, t1, 'window')
      return <WindowGlass id={`${svgIdPrefix}-w-${c}-${r}-${edge}`} quad={quad} />
    }
    const quad = openingQuad(g0, g1, t0, t1, 'door')
    return <DoorPanel id={`${svgIdPrefix}-d-${c}-${r}-${edge}`} quad={quad} />
  }

  const body: ReactNode[] = []
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
    const tilePoints = diamondPoints(x, y, 0)
    body.push(<polygon key={`t-${key}`} points={tilePoints} fill={(c + r) % 2 === 0 ? FLOOR_FILL_A : FLOOR_FILL_B} />)
    body.push(<polygon key={`tg-${key}`} points={tilePoints} fill={`url(#${floorGrainId})`} opacity={0.5} />)
    body.push(<polygon key={`ts-${key}`} points={tilePoints} fill={`url(#${floorSheenId})`} />)
    body.push(<polygon key={`t2-${key}`} points={tilePoints} fill="none" stroke="rgba(27,25,36,.065)" />)

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
            queuesById={queuesById}
            onSelect={onSelectAgent}
            onPointerOver={handleSeatOver}
            onPointerMove={handleSeatMove}
            onPointerOut={handleSeatOut}
            clipPrefix={svgIdPrefix}
          />,
        )
      } else {
        body.push(<VacantSeat key={`s-${key}`} x={x} y={y} />)
      }
    }
  }

  return (
    <>
      <div className="fv3d-wrap" onPointerLeave={handleSeatOut}>
        <svg
          className="fv3d-svg"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={`${svgIdPrefix}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter id={`${svgIdPrefix}-glow`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5.5" />
            </filter>
            <pattern id={floorGrainId} width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="transparent" />
              <circle cx="2.5" cy="2.5" r="0.35" fill="rgba(27,25,36,0.02)" />
              <circle cx="7.5" cy="7.5" r="0.3" fill="rgba(27,25,36,0.016)" />
            </pattern>
            <linearGradient id={floorSheenId} gradientUnits="objectBoundingBox" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
              <stop offset="100%" stopColor="rgba(27,25,36,0.03)" />
            </linearGradient>
          </defs>
          <g filter={`url(#${svgIdPrefix}-shadow)`} fill="rgba(27,25,36,.10)">
            {shadows}
          </g>
          {body}
        </svg>
      </div>
      {tooltip
        ? createPortal(
            <FloorSeatTooltip
              agent={tooltip.agent}
              queuesById={queuesById}
              x={tooltip.x}
              y={tooltip.y}
              open={tooltipOpen}
              onExited={handleTooltipExited}
            />,
            document.body,
          )
        : null}
    </>
  )
}
