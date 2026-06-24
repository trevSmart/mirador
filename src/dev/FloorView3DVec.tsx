/* EXPERIMENTAL — Dev tab only. A vectorial-basis clone of FloorView3D used to
   eyeball whether a non-45° (dimetric) azimuth stops towers from fully occluding
   each other. Self-contained: it borrows only read-only helpers from the
   official modules. Delete `src/dev/` to remove the experiment entirely. */

import { useCallback, useMemo, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { FloorSeatTooltip } from '../components/floor/FloorSeatTooltip'
import { useTowerHeightScale } from '../hooks/useTowerHeightScale'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { agentInitials } from '../utils/format'
import { agentTowerSegments, towerSegmentLabel, type TowerSegment } from '../floor/agent-tower-segments'
import type { Agent, Queue } from '../api/types'
import type { Floor } from '../floor/types'
import {
  type IsoBasis,
  type Point,
  VEC_SEAT_MAX_H,
  VEC_SEAT_MIN_H,
  VEC_TH,
  VEC_TW,
  backLeftOpeningEdge,
  backLeftTrue,
  backLeftWallVec,
  backRightOpeningEdge,
  backRightTrue,
  backRightWallVec,
  computeBoundsVec,
  depthCompareVec,
  diamondPointsVec,
  dividerFaceVec,
  normalizeFloor,
  openingQuad,
  projectCellVec,
  slabLeftFaceVec,
  slabRightFaceVec,
  towerLeftFace,
  towerRightFace,
} from './floor-iso-vec'

const GRID_MAX = 49

const PEDESTAL_COLOR = 'var(--text-disabled)'
const AVATAR_RING = 'var(--border-subtle)'
const FLOOR_FILL_A = '#F8F7F4'
const FLOOR_FILL_B = '#F5F4F1'
const WALL_FILL = 'rgb(247,246,243)'

const BAND_H = 4.5
const BAND_OPACITY = 0.68
const FACE_OPACITY_BOTTOM = 0.6
const FACE_OPACITY_TOP = 0.22
const SHADE_LEFT = 'rgba(12,10,22,0.12)'
const SHADE_RIGHT = 'rgba(12,10,22,0.04)'
const BAND_STROKE_OPACITY = 0.55
const BAND_STROKE_WIDTH = 0.85

function seatHeight(agent: Agent): number {
  const ratio = agent.max > 0 ? Math.min(1, agent.used / agent.max) : 0
  return VEC_SEAT_MIN_H + ratio * (VEC_SEAT_MAX_H - VEC_SEAT_MIN_H)
}

type OpeningQuad = { bl: Point; br: Point; tr: Point; tl: Point }

function openingQuadPoints(q: OpeningQuad): string {
  return `${q.bl[0]},${q.bl[1]} ${q.br[0]},${q.br[1]} ${q.tr[0]},${q.tr[1]} ${q.tl[0]},${q.tl[1]}`
}

// --- Pixel-art opening textures, copied from the official FloorView3D so the
// experiment stays self-contained (they only depend on the quad corners). ---

function lerpPt(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}
function quadAt(quad: OpeningQuad, u: number, v: number): Point {
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
      <polygon points={pane} fill="none" stroke="rgba(48, 88, 128, 0.38)" strokeWidth={0.65} strokeLinejoin="miter" />
      <line x1={lerpPt(tl, tr, 0.04)[0]} y1={lerpPt(tl, tr, 0.04)[1]} x2={lerpPt(tl, tr, 0.96)[0]} y2={lerpPt(tl, tr, 0.96)[1]} stroke="rgba(48, 88, 128, 0.22)" strokeWidth={0.5} />
    </g>
  )
}

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
      <polygon points={pane} fill="none" stroke="rgba(88, 72, 58, 0.4)" strokeWidth={0.65} strokeLinejoin="miter" />
      <line x1={lerpPt(tl, tr, 0.04)[0]} y1={lerpPt(tl, tr, 0.04)[1]} x2={lerpPt(tl, tr, 0.96)[0]} y2={lerpPt(tl, tr, 0.96)[1]} stroke="rgba(88, 72, 58, 0.24)" strokeWidth={0.5} />
      <line x1={quadAt(quad, 0.06, panelLineY)[0]} y1={quadAt(quad, 0.06, panelLineY)[1]} x2={quadAt(quad, 0.94, panelLineY)[0]} y2={quadAt(quad, 0.94, panelLineY)[1]} stroke="rgba(88, 72, 58, 0.2)" strokeWidth={0.5} />
      <circle cx={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[0]} cy={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[1]} r={1.4} fill="rgba(168, 148, 118, 0.75)" stroke="rgba(88, 72, 58, 0.35)" strokeWidth={0.4} />
    </g>
  )
}

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

function TowerFaceGradient({ id, x, y, h }: { id: string; x: number; y: number; h: number }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x} y2={y - h}>
      <stop offset="0%" stopColor="currentColor" stopOpacity={FACE_OPACITY_BOTTOM} />
      <stop offset="100%" stopColor="currentColor" stopOpacity={FACE_OPACITY_TOP} />
    </linearGradient>
  )
}

function bandFaces(x: number, y: number, b: IsoBasis, h1: number, h2: number, color: string) {
  return (
    <g style={{ color }}>
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill={SHADE_LEFT} />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill={SHADE_RIGHT} />
      <polygon points={diamondPointsVec(x, y, b, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon points={diamondPointsVec(x, y, b, h2)} fill="rgba(255,255,255,0.12)" />
    </g>
  )
}

function shaftSegmentFaces(x: number, y: number, b: IsoBasis, h1: number, h2: number, h: number, color: string, gradId: string) {
  const fill = `url(#${gradId})`
  return (
    <g style={{ color }}>
      <defs>
        <TowerFaceGradient id={gradId} x={x} y={y} h={h} />
      </defs>
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill={fill} />
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill={SHADE_LEFT} />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill={fill} />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill={SHADE_RIGHT} />
    </g>
  )
}

function segmentedTowerFaces(x: number, y: number, b: IsoBasis, h: number, segments: TowerSegment[], idBase: string) {
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
    parts.push(<g key={`${seg.queueId ?? 'unknown'}-${i}`}>{shaftSegmentFaces(x, y, b, cursor, top, h, seg.color, `${idBase}-sg${i}`)}</g>)
    cursor = top
  }
  if (segments.length === 0 && shaftH > 0) {
    parts.push(<g key="shaft-fallback">{shaftSegmentFaces(x, y, b, base, shaftTop, h, PEDESTAL_COLOR, `${idBase}-sgf`)}</g>)
  }

  return (
    <>
      <g key="pedestal">{bandFaces(x, y, b, 0, base, PEDESTAL_COLOR)}</g>
      {parts}
      {capH > 0 ? <g key="cap">{bandFaces(x, y, b, shaftTop, h, topColor)}</g> : null}
    </>
  )
}

function towerTitle(agent: Agent, queuesById: Map<string, Queue>): string {
  const segments = agentTowerSegments(agent, queuesById)
  const load = `${agent.used}/${agent.max}`
  if (segments.length === 0) return `${agent.name} · ${load}`
  const breakdown = segments.map((seg) => `${towerSegmentLabel(seg, queuesById)} ${seg.count}`).join(', ')
  return `${agent.name} · ${load} · ${breakdown}`
}

interface IsoSeatProps {
  agent: Agent
  x: number
  y: number
  b: IsoBasis
  showAvatars: boolean
  animations: boolean
  queuesById: Map<string, Queue>
  onSelect: (agent: Agent) => void
  onPointerOver: (agent: Agent, event: ReactPointerEvent<SVGGElement>) => void
  onPointerMove: (agent: Agent, event: ReactPointerEvent<SVGGElement>) => void
  onPointerOut: () => void
  clipPrefix: string
}

function IsoSeat({ agent, x, y, b, showAvatars, animations, queuesById, onSelect, onPointerOver, onPointerMove, onPointerOut, clipPrefix }: IsoSeatProps) {
  const saturated = agent.max > 0 && agent.used >= agent.max
  const ratio = agent.max > 0 ? Math.min(1, agent.used / agent.max) : 0
  const segments = agentTowerSegments(agent, queuesById)
  const title = towerTitle(agent, queuesById)
  const topColor = segments[segments.length - 1]?.color ?? PEDESTAL_COLOR
  const targetH = seatHeight(agent)
  const h = useTowerHeightScale(targetH, true)
  const idBase = `${clipPrefix}-${agent.id}`

  const glow =
    ratio > 0.04 ? (
      <ellipse key="glow" cx={x} cy={y} rx={VEC_TW * 0.92} ry={VEC_TH * 0.92} style={{ fill: topColor }} opacity={0.16 + ratio * 0.34} filter={`url(#${clipPrefix}-glow)`} />
    ) : null

  const body = (
    <>
      {glow}
      <g key="tower">{segmentedTowerFaces(x, y, b, h, segments, idBase)}</g>
      <g className={`fv3d-avatar${showAvatars ? ' fv3d-avatar--on' : ''}`}>
        <AvatarDisc key="avatar" agent={agent} cx={x} cy={y - h - VEC_TH * 0.62} r={VEC_TH * 1.05} ring={AVATAR_RING} showPhoto clipPrefix={clipPrefix} />
      </g>
      {saturated ? (
        <>
          <line key="beacon-stem" x1={x} y1={y - h} x2={x} y2={y - h - VEC_TH * 1.6} stroke="#E05641" strokeWidth={1.5} />
          <circle key="beacon" className={animations ? 'fv3d-beacon' : undefined} cx={x} cy={y - h - VEC_TH * 1.6} r={4.5} fill="#E05641" stroke="#fff" strokeWidth={1.5} />
        </>
      ) : null}
    </>
  )

  return (
    <g className="fv3d-seat" onClick={() => onSelect(agent)} onPointerOver={(e) => onPointerOver(agent, e)} onPointerMove={(e) => onPointerMove(agent, e)} onPointerOut={onPointerOut} role="button" aria-label={title}>
      {body}
    </g>
  )
}

function VacantSeat({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <title>Seient lliure</title>
      <ellipse cx={x} cy={y} rx={VEC_TW * 0.42} ry={VEC_TH * 0.42} fill="none" stroke="rgba(27,25,36,.22)" strokeDasharray="3 3" />
    </g>
  )
}

interface FloorView3DVecProps {
  floor: Floor
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  basis: IsoBasis
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
}

export function FloorView3DVec({ floor, agentsById, queuesById, basis, showAvatars, animations, onSelectAgent }: FloorView3DVecProps) {
  const [tooltip, setTooltip] = useState<{ agent: Agent; x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const tipAt = useCallback((agent: Agent, clientX: number, clientY: number) => {
    setTooltip({ agent, x: clientX + 14, y: clientY + 14 })
    setTooltipOpen(true)
  }, [])
  const handleSeatOver = useCallback((agent: Agent, e: ReactPointerEvent<SVGGElement>) => tipAt(agent, e.clientX, e.clientY), [tipAt])
  const handleSeatMove = useCallback((agent: Agent, e: ReactPointerEvent<SVGGElement>) => tipAt(agent, e.clientX, e.clientY), [tipAt])
  const handleSeatOut = useCallback(() => setTooltipOpen(false), [])
  const handleTooltipExited = useCallback(() => setTooltip(null), [])

  const plan = useMemo(() => normalizeFloor(floor), [floor])

  const cellSet = useMemo(() => new Set(plan.cells.map(([c, r]) => `${c},${r}`)), [plan])
  const has = useMemo(() => (c: number, r: number) => cellSet.has(`${c},${r}`), [cellSet])

  const seatByKey = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof plan.seats.find>>>()
    for (const seat of plan.seats) map.set(`${seat.c},${seat.r}`, seat)
    return map
  }, [plan])

  const dividersByKey = useMemo(() => {
    const map = new Map<string, { c: number; r: number; edge: 'E' | 'S' }[]>()
    for (const d of plan.dividers) {
      const key = `${d.c},${d.r}`
      const list = map.get(key) ?? []
      list.push(d)
      map.set(key, list)
    }
    return map
  }, [plan])

  const openingByKey = useMemo(() => {
    const map = new Map<string, 'door' | 'window'>()
    for (const o of plan.openings) map.set(`${o.c},${o.r},${o.edge}`, o.kind)
    return map
  }, [plan])

  const ordered = useMemo(() => [...plan.cells].sort(depthCompareVec(basis)), [plan, basis])
  const svgIdPrefix = `fvvec-${floor.id}`
  const floorGrainId = `${svgIdPrefix}-floor-grain`
  const floorSheenId = `${svgIdPrefix}-floor-sheen`
  const bounds = useMemo(() => computeBoundsVec(plan.cells, basis, VEC_TH * 2), [plan, basis])

  const brVis = useMemo(() => backRightTrue(has, plan.cells, 0, GRID_MAX, GRID_MAX), [has, plan])
  const blVis = useMemo(() => backLeftTrue(has, plan.cells, 0, GRID_MAX, GRID_MAX), [has, plan])

  const pos = (c: number, r: number) => projectCellVec(c, r, basis)

  const shadows = plan.cells.map(([c, r]) => {
    const [x, y] = pos(c, r)
    return <polygon key={`sh-${c}-${r}`} points={diamondPointsVec(x, y, basis, 0)} />
  })

  const openingPolys = (c: number, r: number, edge: 'N' | 'O', x: number, y: number) => {
    const kind = openingByKey.get(`${c},${r},${edge}`)
    if (!kind) return null
    const [g0, g1, t0, t1] = edge === 'N' ? backRightOpeningEdge(x, y, basis) : backLeftOpeningEdge(x, y, basis)
    const quad = openingQuad(g0, g1, t0, t1, kind)
    const id = `${svgIdPrefix}-${kind === 'window' ? 'w' : 'd'}-${c}-${r}-${edge}`
    return (
      <g key={`op-${c}-${r}-${edge}`}>
        {kind === 'window' ? <WindowGlass id={id} quad={quad} /> : <DoorPanel id={id} quad={quad} />}
      </g>
    )
  }

  const body: ReactNode[] = []
  for (const [c, r] of ordered) {
    const [x, y] = pos(c, r)
    const key = `${c},${r}`

    if (brVis(c, r)) {
      body.push(<polygon key={`wbr-${key}`} points={backRightWallVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`wbr2-${key}`} points={backRightWallVec(x, y, basis)} fill="rgba(27,25,36,.032)" stroke="rgba(27,25,36,.05)" strokeWidth={0.5} />)
      const op = openingPolys(c, r, 'N', x, y)
      if (op) body.push(op)
    }
    if (blVis(c, r)) {
      body.push(<polygon key={`wbl-${key}`} points={backLeftWallVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`wbl2-${key}`} points={backLeftWallVec(x, y, basis)} fill="rgba(27,25,36,.05)" stroke="rgba(27,25,36,.06)" strokeWidth={0.5} />)
      const op = openingPolys(c, r, 'O', x, y)
      if (op) body.push(op)
    }

    if (!has(c + 1, r)) body.push(<polygon key={`rf-${key}`} points={slabRightFaceVec(x, y, basis)} fill="rgba(27,25,36,.05)" />)
    if (!has(c, r + 1)) body.push(<polygon key={`lf-${key}`} points={slabLeftFaceVec(x, y, basis)} fill="rgba(27,25,36,.08)" />)

    const tilePoints = diamondPointsVec(x, y, basis, 0)
    body.push(<polygon key={`t-${key}`} points={tilePoints} fill={(c + r) % 2 === 0 ? FLOOR_FILL_A : FLOOR_FILL_B} />)
    body.push(<polygon key={`tg-${key}`} points={tilePoints} fill={`url(#${floorGrainId})`} opacity={0.5} />)
    body.push(<polygon key={`ts-${key}`} points={tilePoints} fill={`url(#${floorSheenId})`} />)
    body.push(<polygon key={`t2-${key}`} points={tilePoints} fill="none" stroke="rgba(27,25,36,.065)" />)

    for (const d of dividersByKey.get(key) ?? []) {
      body.push(<polygon key={`dv-${key}-${d.edge}`} points={dividerFaceVec(x, y, basis, d.edge)} fill="rgba(47,158,143,.30)" stroke="rgba(47,158,143,.75)" strokeWidth={1.2} />)
    }

    const seat = seatByKey.get(key)
    if (seat) {
      const agent = seat.agentId ? agentsById.get(seat.agentId) ?? null : null
      if (agent) {
        body.push(
          <IsoSeat key={`s-${key}`} agent={agent} x={x} y={y} b={basis} showAvatars={showAvatars} animations={animations} queuesById={queuesById} onSelect={onSelectAgent} onPointerOver={handleSeatOver} onPointerMove={handleSeatMove} onPointerOut={handleSeatOut} clipPrefix={svgIdPrefix} />,
        )
      } else {
        body.push(<VacantSeat key={`s-${key}`} x={x} y={y} />)
      }
    }
  }

  return (
    <>
      <div className="fv3d-wrap" onPointerLeave={handleSeatOut}>
        <svg className="fv3d-svg" viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }} xmlns="http://www.w3.org/2000/svg">
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
            <FloorSeatTooltip agent={tooltip.agent} queuesById={queuesById} x={tooltip.x} y={tooltip.y} open={tooltipOpen} onExited={handleTooltipExited} />,
            document.body,
          )
        : null}
    </>
  )
}
