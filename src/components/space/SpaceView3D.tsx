import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { SpaceSeatTooltip } from './SpaceSeatTooltip'
import { useTowerHeightScale } from '../../hooks/useTowerHeightScale'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { colorFromString } from '../../utils/color-from-string'
import { agentInitials } from '../../utils/format'
import { agentTowerSegments, towerSegmentLabel, type TowerSegment } from '../../space/agent-tower-segments'
import type { Agent, Queue } from '../../api/types'
import type { Space } from '../../space/types'
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
  makeBasis,
  normalizeSpace,
  openingQuad,
  projectCellVec,
  slabLeftFaceVec,
  slabRightFaceVec,
  towerLeftFace,
  towerRightFace,
  windowBeamVolume,
} from '../../space/space-iso-vec'
import {
  type RoomRotation,
  ROOM_AZ_MAX,
  ROOM_AZ_MIN,
  ROOM_TILT_MAX,
  ROOM_TILT_MIN,
  loadRoomRotation,
  saveRoomRotation,
} from '../../space/space-rotation-store'

const GRID_MAX = 49

const PEDESTAL_COLOR = '#E2DFDA'
const AVATAR_RING = 'var(--accent-30)'
const SPACE_FILL_A = '#FDFCFB'
const SPACE_FILL_B = '#FBFAF8'
const WALL_FILL = 'rgb(252,251,249)'

// Shared sun direction for every window's light shaft, expressed in cell units
// (so it scales with the camera). Common direction → all beams stay parallel,
// reading as one off-screen light source rather than per-wall spotlights.
const SUN_X = 0.55
const SUN_Y = 1.45
const SUN_LENGTH = 1.1
// Extra half-width the beam gains by the end of its throw (× the sill width),
// so the light fans out as it crosses the space.
const SUN_SPREAD = 1.2
// How much farther the window's TOP edge throws than its bottom edge. >1 opens
// the shaft's angle so the far edge reaches deeper into the room while the near
// edge stays pinned at the sill — daylight spilling in, not aimed at the floor.
const SUN_TOP_REACH = 2.0

// Base and cap are solid, outlined slabs with real thickness — they frame the
// translucent shaft between them (the mirador capsule look).
const BAND_H = 4.5
const BAND_OPACITY = 0.68
// Glassy tower face: the colour stays the queue hue but fades to translucent
// toward the top, giving the whole shaft a vertical "rising glass" gradient.
const FACE_OPACITY_BOTTOM = 0.6
const FACE_OPACITY_TOP = 0.22
// Lit (right) vs. shaded (left) faces keep a faint dark wash for iso depth.
const SHADE_LEFT = 'rgba(12,10,22,0.12)'
const SHADE_RIGHT = 'rgba(12,10,22,0.04)'
// The agent pedestal is a pale, near-space-coloured slab, so the tower's dark
// side-shading would read as a heavy grey block. Use much softer washes for it.
const PEDESTAL_SHADE_LEFT = 'rgba(12,10,22,0.05)'
const PEDESTAL_SHADE_RIGHT = 'rgba(12,10,22,0.015)'
const BAND_STROKE_OPACITY = 0.55
const BAND_STROKE_WIDTH = 0.85

// Drag-to-orbit sensitivity (degrees / px and tilt-units / px) + the click-vs-
// drag threshold so plain taps still select a tower.
const DRAG_AZ_PER_PX = 0.25
const DRAG_TILT_PER_PX = 0.0018
const DRAG_THRESHOLD = 3

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function seatHeight(agent: Agent): number {
  const ratio = agent.max > 0 ? Math.min(1, agent.used / agent.max) : 0
  return VEC_SEAT_MIN_H + ratio * (VEC_SEAT_MAX_H - VEC_SEAT_MIN_H)
}

type OpeningQuad = { bl: Point; br: Point; tr: Point; tl: Point }

function openingQuadPoints(q: OpeningQuad): string {
  return `${q.bl[0]},${q.bl[1]} ${q.br[0]},${q.br[1]} ${q.tr[0]},${q.tr[1]} ${q.tl[0]},${q.tl[1]}`
}

// --- Pixel-art opening textures: they only depend on the quad corners. ---

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
          <stop offset="0%" stopColor="rgba(198, 230, 252, 0.42)" />
          <stop offset="55%" stopColor="rgba(128, 184, 230, 0.32)" />
          <stop offset="100%" stopColor="rgba(74, 126, 180, 0.26)" />
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

/** Volumetric shaft of daylight: the whole window pane projected across the room
   as a 3D parallelepiped that widens toward the floor. Three faces are drawn —
   the floor pool, the two angled side walls of the shaft, and a translucent cap
   — each with a gradient that fades from the window (bright) into the room. The
   side faces carry slightly different opacities (lit vs. shaded) so the volume
   reads as a solid wedge of light, not a flat smear. Drawn over the tiles but
   under the furniture/seats. */
function WindowLightVolume({
  id,
  floor,
  sideL,
  sideR,
  cap,
  near,
  far,
  blurId,
}: {
  id: string
  floor: string
  sideL: string
  sideR: string
  cap: string
  near: [Point, Point]
  far: [Point, Point]
  blurId: string
}) {
  const nx = (near[0][0] + near[1][0]) / 2
  const ny = (near[0][1] + near[1][1]) / 2
  const fx = (far[0][0] + far[1][0]) / 2
  const fy = (far[0][1] + far[1][1]) / 2
  const floorGrad = `${id}-floor`
  const capGrad = `${id}-cap`
  const sideGrad = `${id}-side`
  return (
    <g style={{ mixBlendMode: 'multiply' }} filter={`url(#${blurId})`}>
      <defs>
        {/* Pool on the floor: brightest where the light lands near the wall, then
           falls off fast so the beam dies close to the window rather than washing
           across the whole room. The stops are bunched toward the start (mid at
           28%, fully clear by 62%) to compress the fade into the near zone. */}
        <linearGradient id={floorGrad} x1={nx} y1={ny} x2={fx} y2={fy} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(150,178,214,0.07)" />
          <stop offset="16%" stopColor="rgba(178,200,228,0.022)" />
          <stop offset="38%" stopColor="rgba(220,232,245,0)" />
        </linearGradient>
        {/* Translucent ceiling of the shaft, fading on the same fast curve. */}
        <linearGradient id={capGrad} x1={nx} y1={ny} x2={fx} y2={fy} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(160,186,220,0.095)" />
          <stop offset="18%" stopColor="rgba(196,214,234,0.03)" />
          <stop offset="40%" stopColor="rgba(232,240,248,0)" />
        </linearGradient>
        {/* Side walls: a touch denser so the wedge edges read as volume. */}
        <linearGradient id={sideGrad} x1={nx} y1={ny} x2={fx} y2={fy} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(154,182,218,0.08)" />
          <stop offset="18%" stopColor="rgba(188,208,232,0.028)" />
          <stop offset="40%" stopColor="rgba(226,236,246,0)" />
        </linearGradient>
      </defs>
      <polygon points={cap} fill={`url(#${capGrad})`} />
      <polygon points={sideL} fill={`url(#${sideGrad})`} />
      <polygon points={sideR} fill={`url(#${sideGrad})`} opacity={0.7} />
      <polygon points={floor} fill={`url(#${floorGrad})`} />
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
      <polygon points={pane} fill="none" stroke="rgba(88, 72, 58, 0.4)" strokeWidth={0.65} strokeLinejoin="miter" />
      <line x1={lerpPt(tl, tr, 0.04)[0]} y1={lerpPt(tl, tr, 0.04)[1]} x2={lerpPt(tl, tr, 0.96)[0]} y2={lerpPt(tl, tr, 0.96)[1]} stroke="rgba(88, 72, 58, 0.24)" strokeWidth={0.5} />
      <line x1={quadAt(quad, 0.06, panelLineY)[0]} y1={quadAt(quad, 0.06, panelLineY)[1]} x2={quadAt(quad, 0.94, panelLineY)[0]} y2={quadAt(quad, 0.94, panelLineY)[1]} stroke="rgba(88, 72, 58, 0.2)" strokeWidth={0.5} />
      <circle cx={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[0]} cy={lerpPt(lerpPt(bl, br, 0.88), lerpPt(tl, tr, 0.88), 0.42)[1]} r={1.4} fill="rgba(168, 148, 118, 0.75)" stroke="rgba(88, 72, 58, 0.35)" strokeWidth={0.4} />
    </g>
  )
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
      <circle cx={cx} cy={cy} r={r} fill={colorFromString(agent.name)} />
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
          fill="var(--mi-av-fg, #514E5C)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {agentInitials(agent.name)}
        </text>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={1} />
    </g>
  )
}

/** Vertical colour gradient spanning the FULL tower height, so each stacked
   segment exposes the slice of the fade that matches its own elevation. */
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
function bandFaces(x: number, y: number, b: IsoBasis, h1: number, h2: number, color: string, shadeLeft = SHADE_LEFT, shadeRight = SHADE_RIGHT) {
  return (
    <g style={{ color }}>
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon className="fv3d-noedge" points={towerLeftFace(x, y, b, h1, h2)} fill={shadeLeft} />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon className="fv3d-noedge" points={towerRightFace(x, y, b, h1, h2)} fill={shadeRight} />
      <polygon points={diamondPointsVec(x, y, b, h2)} fill="currentColor" fillOpacity={BAND_OPACITY} stroke="currentColor" strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={BAND_STROKE_WIDTH} strokeLinejoin="round" />
      <polygon className="fv3d-noedge" points={diamondPointsVec(x, y, b, h2)} fill="rgba(255,255,255,0.12)" />
    </g>
  )
}

/** A glassy shaft segment: just the two side faces, painted with the vertical
   colour gradient (no top — the cap band covers the shaft). */
function shaftSegmentFaces(x: number, y: number, b: IsoBasis, h1: number, h2: number, h: number, color: string, gradId: string) {
  const fill = `url(#${gradId})`
  return (
    <g style={{ color }}>
      <defs>
        <TowerFaceGradient id={gradId} x={x} y={y} h={h} />
      </defs>
      <polygon points={towerLeftFace(x, y, b, h1, h2)} fill={fill} />
      <polygon className="fv3d-noedge" points={towerLeftFace(x, y, b, h1, h2)} fill={SHADE_LEFT} />
      <polygon points={towerRightFace(x, y, b, h1, h2)} fill={fill} />
      <polygon className="fv3d-noedge" points={towerRightFace(x, y, b, h1, h2)} fill={SHADE_RIGHT} />
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
    const seg = segments[i]
    const top = cursor + shaftH * seg.fraction
    parts.push(<g key={`${seg.queueId ?? 'unknown'}-${i}`}>{shaftSegmentFaces(x, y, b, cursor, top, h, seg.color, `${idBase}-sg${i}`)}</g>)
    cursor = top
  }
  if (segments.length === 0 && shaftH > 0) {
    parts.push(<g key="shaft-fallback">{shaftSegmentFaces(x, y, b, base, shaftTop, h, PEDESTAL_COLOR, `${idBase}-sgf`)}</g>)
  }

  return (
    <>
      <g key="pedestal">{bandFaces(x, y, b, 0, base, PEDESTAL_COLOR, PEDESTAL_SHADE_LEFT, PEDESTAL_SHADE_RIGHT)}</g>
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
      {saturated ? <SaturationBeacon x={x} avatarCy={y - h - VEC_TH * 0.62} animations={animations} /> : null}
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

/** A copy of the hovered seat's avatar, drawn in a top layer so it sits above
    every other avatar/tower regardless of painter order. Recomputes the same
    animated tower height so it lands exactly on the original. */
function HoverAvatar({ agent, x, y, animations, clipPrefix }: { agent: Agent; x: number; y: number; animations: boolean; clipPrefix: string }) {
  const h = useTowerHeightScale(seatHeight(agent), true)
  const avatarCy = y - h - VEC_TH * 0.62
  const saturated = agent.max > 0 && agent.used >= agent.max
  return (
    <g className="fv3d-avatar-hover" style={{ pointerEvents: 'none' }}>
      <AvatarDisc agent={agent} cx={x} cy={avatarCy} r={VEC_TH * 1.05} ring={AVATAR_RING} showPhoto clipPrefix={clipPrefix} />
      {saturated ? <SaturationBeacon x={x} avatarCy={avatarCy} animations={animations} /> : null}
    </g>
  )
}

/** El punt vermell de saturació, posicionat sobre la vora del disc de l'avatar
    (lleugerament a la dreta de dalt). S'extreu en un component per poder-lo
    redibuixar idènticament a la capa de hover. */
function SaturationBeacon({ x, avatarCy, animations }: { x: number; avatarCy: number; animations: boolean }) {
  const avatarR = VEC_TH * 1.05
  const beaconAngle = (Math.PI / 180) * 38
  const beaconCx = x + avatarR * Math.sin(beaconAngle)
  const beaconCy = avatarCy - avatarR * Math.cos(beaconAngle)
  return (
    <circle key="beacon" className={animations ? 'fv3d-beacon' : undefined} cx={beaconCx} cy={beaconCy} r={4.5} fill="#E05641" stroke="#fff" strokeWidth={1.5} />
  )
}

interface SpaceView3DProps {
  space: Space
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
}

export function SpaceView3D({ space, agentsById, queuesById, showAvatars, animations, onSelectAgent }: SpaceView3DProps) {
  const [tooltip, setTooltip] = useState<{ agent: Agent; x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  // Which seat is hovered, so its avatar can be lifted above every other one
  // (SVG z-order is document order, so we re-draw it in a top overlay layer).
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Per-room camera rotation, hydrated from + persisted to localStorage. When the
  // space prop swaps to a different room, re-hydrate for that space (render-time
  // reset, matching SpacePanel's prefs pattern).
  const [rotation, setRotation] = useState<RoomRotation>(() => loadRoomRotation(space.id))
  const dirtyRef = useRef(false)
  const rotSpaceIdRef = useRef(space.id)

  useEffect(() => {
    if (rotSpaceIdRef.current === space.id) return
    rotSpaceIdRef.current = space.id
    setRotation(loadRoomRotation(space.id))
  }, [space.id])

  // On (re)hydration for a space, clear the dirty flag so the just-loaded value
  // is never written straight back. Declared BEFORE the persist effect so it
  // wins the same commit when the space id changes.
  useEffect(() => {
    dirtyRef.current = false
  }, [space.id])

  // Persist only after the user actually orbits, so merely viewing a room never
  // writes a default entry for it.
  useEffect(() => {
    if (!dirtyRef.current) return
    const id = window.setTimeout(() => saveRoomRotation(space.id, rotation), 250)
    return () => window.clearTimeout(id)
  }, [space.id, rotation])

  const basis = useMemo(() => makeBasis(rotation.az, rotation.tilt), [rotation.az, rotation.tilt])

  // Drag-to-orbit. The pointer origin + az/tilt captured at press; `active` only
  // flips once the pointer moves past a threshold, so plain clicks (selecting a
  // tower) are never swallowed by the orbit capture.
  const [dragging, setDragging] = useState(false)
  const orbitRef = useRef<{ x: number; y: number; az: number; tilt: number; active: boolean } | null>(null)

  const onDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      orbitRef.current = { x: event.clientX, y: event.clientY, az: rotation.az, tilt: rotation.tilt, active: false }
    },
    [rotation.az, rotation.tilt],
  )

  const onMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = orbitRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      start.active = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    // Horizontal → azimuth (orbit around), vertical → tilt (drag down = flatter).
    dirtyRef.current = true
    setRotation({
      az: clamp(start.az - dx * DRAG_AZ_PER_PX, ROOM_AZ_MIN, ROOM_AZ_MAX),
      tilt: clamp(start.tilt + dy * DRAG_TILT_PER_PX, ROOM_TILT_MIN, ROOM_TILT_MAX),
    })
  }, [])

  const onUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = orbitRef.current
    orbitRef.current = null
    setDragging(false)
    if (start?.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const tipAt = useCallback((agent: Agent, clientX: number, clientY: number) => {
    setTooltip({ agent, x: clientX + 14, y: clientY + 14 })
    setTooltipOpen(true)
  }, [])
  const handleSeatOver = useCallback(
    (agent: Agent, e: ReactPointerEvent<SVGGElement>) => {
      setHoveredId(agent.id)
      tipAt(agent, e.clientX, e.clientY)
    },
    [tipAt],
  )
  const handleSeatMove = useCallback((agent: Agent, e: ReactPointerEvent<SVGGElement>) => tipAt(agent, e.clientX, e.clientY), [tipAt])
  const handleSeatOut = useCallback(() => {
    setHoveredId(null)
    setTooltipOpen(false)
  }, [])
  const handleTooltipExited = useCallback(() => setTooltip(null), [])

  const plan = useMemo(() => normalizeSpace(space), [space])

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
  const svgIdPrefix = `fv3d-${space.id}`
  const spaceGrainId = `${svgIdPrefix}-space-grain`
  const spaceSheenId = `${svgIdPrefix}-space-sheen`
  const wallSheenRightId = `${svgIdPrefix}-wall-sheen-r`
  const wallSheenLeftId = `${svgIdPrefix}-wall-sheen-l`
  const beamBlurId = `${svgIdPrefix}-beam-blur`
  const bounds = useMemo(() => computeBoundsVec(plan.cells, basis, VEC_TH * 2), [plan, basis])

  // The render's *outer* size is height-driven: width = --fv-render-h × aspect.
  // While orbiting, `bounds` changes every frame (the room's silhouette shifts
  // with the camera), which would resize the outer box each frame and make the
  // room appear to slide/jump — especially once max-width caps the width and the
  // height carries the change. So the outer aspect-ratio is held in state and
  // only re-synced to `bounds` when NOT dragging: during a drag it stays frozen
  // (the SVG viewBox still rotates inside the fixed-size box), and it snaps to
  // the final shape once the drag settles.
  const [outerAspectN, setOuterAspectN] = useState(() => bounds.width / bounds.height)
  useEffect(() => {
    if (dragging) return
    const next = bounds.width / bounds.height
    setOuterAspectN((prev) => (prev === next ? prev : next))
  }, [dragging, bounds.width, bounds.height])

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
  const sunbeams: ReactNode[] = []
  for (const [c, r] of ordered) {
    const [x, y] = pos(c, r)
    const key = `${c},${r}`

    if (brVis(c, r)) {
      body.push(<polygon key={`wbr-${key}`} points={backRightWallVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`wbr2-${key}`} points={backRightWallVec(x, y, basis)} fill="rgba(27,25,36,.032)" stroke="rgba(27,25,36,.05)" strokeWidth={0.5} />)
      body.push(<polygon key={`wbrs-${key}`} points={backRightWallVec(x, y, basis)} fill={`url(#${wallSheenRightId})`} />)
      const op = openingPolys(c, r, 'N', x, y)
      if (op) body.push(op)
    }
    if (blVis(c, r)) {
      body.push(<polygon key={`wbl-${key}`} points={backLeftWallVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`wbl2-${key}`} points={backLeftWallVec(x, y, basis)} fill="rgba(27,25,36,.05)" stroke="rgba(27,25,36,.06)" strokeWidth={0.5} />)
      body.push(<polygon key={`wbls-${key}`} points={backLeftWallVec(x, y, basis)} fill={`url(#${wallSheenLeftId})`} />)
      const op = openingPolys(c, r, 'O', x, y)
      if (op) body.push(op)
    }

    // Slab-thickness side faces are tinted to match the back wall they run
    // parallel to, then darkened by a constant delta so the space edge always
    // reads as an arris (a shade below its wall), not the same plane.
    // slabRight ‖ back-LEFT wall (vector v); slabLeft ‖ back-RIGHT wall (vector u).
    if (!has(c + 1, r)) {
      body.push(<polygon key={`rf-${key}`} points={slabRightFaceVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`rf2-${key}`} points={slabRightFaceVec(x, y, basis)} fill="rgba(27,25,36,.12)" />)
    }
    if (!has(c, r + 1)) {
      body.push(<polygon key={`lf-${key}`} points={slabLeftFaceVec(x, y, basis)} fill={WALL_FILL} />)
      body.push(<polygon key={`lf2-${key}`} points={slabLeftFaceVec(x, y, basis)} fill="rgba(27,25,36,.102)" />)
    }

    const tilePoints = diamondPointsVec(x, y, basis, 0)
    body.push(<polygon key={`t-${key}`} points={tilePoints} fill={(c + r) % 2 === 0 ? SPACE_FILL_A : SPACE_FILL_B} />)
    body.push(<polygon key={`tg-${key}`} points={tilePoints} fill={`url(#${spaceGrainId})`} opacity={0.5} />)
    body.push(<polygon key={`ts-${key}`} points={tilePoints} fill={`url(#${spaceSheenId})`} />)
    body.push(<polygon key={`t2-${key}`} points={tilePoints} fill="none" stroke="rgba(27,25,36,.065)" />)

    // Daylight beams are collected separately and drawn as one layer over the
    // whole space (below seats), so a beam can stretch across several tiles
    // without later-painted neighbour tiles clipping it.
    for (const edge of ['N', 'O'] as const) {
      const visible = edge === 'N' ? brVis(c, r) : blVis(c, r)
      if (!visible || openingByKey.get(`${c},${r},${edge}`) !== 'window') continue
      // The actual window pane on the wall (4 lifted corners). Projecting the
      // whole pane — not just its ground edge — along the sun vector gives the
      // beam real volume: a 3D wedge that widens as it crosses the floor.
      const [g0, g1, t0, t1] = edge === 'N' ? backRightOpeningEdge(x, y, basis) : backLeftOpeningEdge(x, y, basis)
      const pane = openingQuad(g0, g1, t0, t1, 'window')
      const vol = windowBeamVolume(pane, basis, SUN_X, SUN_Y, SUN_LENGTH, SUN_SPREAD, SUN_TOP_REACH)
      sunbeams.push(<WindowLightVolume key={`beam-${key}-${edge}`} id={`${svgIdPrefix}-beam-${c}-${r}-${edge}`} blurId={beamBlurId} {...vol} />)
    }

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

  // Hovered avatar lifted to a top overlay (only meaningful while avatars show).
  const hoveredAgent = hoveredId ? agentsById.get(hoveredId) ?? null : null
  const hoveredSeat = hoveredId ? plan.seats.find((s) => s.agentId === hoveredId) ?? null : null
  const hoverPos = hoveredSeat ? projectCellVec(hoveredSeat.c, hoveredSeat.r, basis) : null

  return (
    <>
      <div
        className="fv3d-wrap"
        onPointerLeave={handleSeatOut}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <svg className="fv3d-svg" viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: outerAspectN, ['--fv-aspect-n' as string]: outerAspectN }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id={`${svgIdPrefix}-shadow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="24" />
            </filter>
            <filter id={`${svgIdPrefix}-glow`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5.5" />
            </filter>
            {/* Soft edges for the daylight beams so they don't read as hard polygons. */}
            <filter id={beamBlurId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            <pattern id={spaceGrainId} width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="transparent" />
              <circle cx="2.5" cy="2.5" r="0.35" fill="rgba(27,25,36,0.02)" />
              <circle cx="7.5" cy="7.5" r="0.3" fill="rgba(27,25,36,0.016)" />
            </pattern>
            <linearGradient id={spaceSheenId} gradientUnits="objectBoundingBox" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
              <stop offset="100%" stopColor="rgba(27,25,36,0.03)" />
            </linearGradient>
            {/* Vertical light wash for the back walls: brighter near the top
               (catches the overhead light) fading to a soft shade at the space.
               The right-facing wall reads a touch lighter than the left, matching
               the space's SHADE_LEFT/RIGHT balance so the two planes separate. */}
            <linearGradient id={wallSheenRightId} gradientUnits="objectBoundingBox" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(27,25,36,0.03)" />
            </linearGradient>
            <linearGradient id={wallSheenLeftId} gradientUnits="objectBoundingBox" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(27,25,36,0.05)" />
            </linearGradient>
          </defs>
          <g filter={`url(#${svgIdPrefix}-shadow)`} fill="rgba(27,25,36,.17)">
            {shadows}
          </g>
          {body}
          {sunbeams}
          {showAvatars && hoveredAgent && hoverPos ? (
            // key per agent → fresh mount when moving avatar→avatar, so the height
            // hook starts at the final height instead of sliding from the previous.
            <HoverAvatar key={hoveredAgent.id} agent={hoveredAgent} x={hoverPos[0]} y={hoverPos[1]} animations={animations} clipPrefix={`${svgIdPrefix}-hover`} />
          ) : null}
        </svg>
      </div>
      {tooltip
        ? createPortal(
            <SpaceSeatTooltip agent={tooltip.agent} queuesById={queuesById} x={tooltip.x} y={tooltip.y} open={tooltipOpen} onExited={handleTooltipExited} />,
            document.body,
          )
        : null}
    </>
  )
}
