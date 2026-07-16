/* EChartsQueueFlow — experiment del Dev Lab.

   Flux cua → agent renderitzat amb Apache ECharts. Va néixer com a
   series-sankey (exemple oficial "sankey-vertical"), però el polígon del
   sankey conserva l'amplada HORITZONTAL del llaç, no la perpendicular: al
   mig de la corba el connector es veia més prim del que toca. Com que el
   gruix representa el nombre d'items i ha de ser constant de cua a agent,
   els connectors són una series-custom: cada work item és un fil de traç
   fix (cable-bus), amb rutes ortogonals (avall → gir → horitzontal → gir →
   avall). Cada feix comparteix carril horitzontal i radi; les cues diferents
   tenen carrils separats per evitar creuaments entre feixos.

   A més del flux cua → agent, es representen REDIRECCIONS cua → cua
   (p. ex. trucades d'Atenció Client derivades a Incidències, o una cua de
   triatge que alimenta una altra cua): línies horitzontals rectes entre el port
   lateral del node d'origen i el port lateral del de destí, centrades
   verticalment amb el node (capçalera + barra de port).

   Sobre el canvas hi van superposats elements reals de l'app: QueueFlowCard
   (variant compacta) per cada cua i AgentCard com a node de la gent. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as echarts from 'echarts/core'
import { CustomChart } from 'echarts/charts'
// Renderer SVG (nítid a qualsevol zoom) o Canvas (menys cost DOM per animació).
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'
import type { Agent } from '../../api/types'
import { AgentCard } from '../AgentCard'
import { QueueFlowCard } from './QueueFlowCard'
import { colorFromRecordId } from '../../utils/color-from-string'
import { flowGroupColor, useQueueFlowModel } from './use-queue-flow-groups'

echarts.use([CustomChart, SVGRenderer, CanvasRenderer])

/** Estratègia d'animació dels polsos als connectors (experiment Dev Lab). */
export type QueueFlowPulseMode = 'per-strand' | 'per-bundle' | 'canvas'

/** Nom zrender dels paths de pols (amagar en pan al mode canvas). */
const PULSE_EL_NAME = 'qflow-pulse'

function echartsRenderer(mode: QueueFlowPulseMode): 'svg' | 'canvas' {
  return mode === 'canvas' ? 'canvas' : 'svg'
}

/** Índex del fil central d'un feix (referència geomètrica). */
function bundleRefIndex(count: number): number {
  return Math.floor((count - 1) / 2)
}

/** Gruix de la barra de pols al llarg del flux (direcció del moviment). */
const SWEEP_BAR_THICK = 5
/** Opacitat mínima del motiu transversal (entre carrils). */
const SWEEP_STRIPE_TROUGH = 0.12

/** Ompliment de la barra de feix: franges alineades als carrils (opac als centres,
    transparent entre ranures) per simular un pols per fil. */
function sweepStripeFill(
  color: string,
  peakAlpha: number,
  laneCount: number,
  strandPx: number,
  along: 'x' | 'y' = 'x',
): string | object {
  if (laneCount <= 1) return withAlpha(color, peakAlpha)
  const crossSpan = laneCount * strandPx
  const troughAlpha = peakAlpha * SWEEP_STRIPE_TROUGH
  const stops: { offset: number; color: string }[] = []
  for (let j = 0; j < laneCount; j++) {
    const left = (j * strandPx) / crossSpan
    const center = ((j + 0.5) * strandPx) / crossSpan
    const right = ((j + 1) * strandPx) / crossSpan
    if (j === 0) stops.push({ offset: left, color: withAlpha(color, troughAlpha) })
    stops.push({ offset: center, color: withAlpha(color, peakAlpha) })
    stops.push({ offset: right, color: withAlpha(color, troughAlpha) })
  }
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: along === 'x' ? 1 : 0,
    y2: along === 'y' ? 1 : 0,
    colorStops: stops,
  }
}

function pathPointTangent(d: string, len: number): { x: number; y: number; angle: number } {
  probePath ??= document.createElementNS('http://www.w3.org/2000/svg', 'path')
  probePath.setAttribute('d', d)
  const total = probePath.getTotalLength()
  const t = Math.max(0, Math.min(len, total))
  const p = probePath.getPointAtLength(t)
  const t2 = Math.min(t + 2, total)
  const p2 = probePath.getPointAtLength(t2)
  const angle = t2 <= t ? 0 : Math.atan2(p2.y - p.y, p2.x - p.x)
  return { x: p.x, y: p.y, angle }
}

/** Pols de feix: barra única amb motiu transversal (sembla un punt per carril). */
function straightSweepPulse(
  axis: 'x' | 'y',
  start: number,
  end: number,
  crossStart: number,
  crossEnd: number,
  laneCount: number,
  strandPx: number,
  color: string,
  alpha: number,
  phaseMs: number,
  duration: number,
): object | null {
  if (Math.abs(end - start) < 1 || Math.abs(crossEnd - crossStart) < 0.5) return null
  const stripeAlong = axis === 'y' ? 'x' : 'y'
  const keyframes = [0, 1].map((frac) => {
    const pos = start + frac * (end - start)
    const shape =
      axis === 'y'
        ? {
            x: crossStart,
            y: pos - SWEEP_BAR_THICK / 2,
            width: crossEnd - crossStart,
            height: SWEEP_BAR_THICK,
          }
        : {
            x: pos - SWEEP_BAR_THICK / 2,
            y: crossStart,
            width: SWEEP_BAR_THICK,
            height: crossEnd - crossStart,
          }
    return { percent: frac, shape }
  })
  return {
    type: 'rect',
    name: PULSE_EL_NAME,
    silent: true,
    shape: keyframes[0].shape,
    style: { fill: sweepStripeFill(color, alpha, laneCount, strandPx, stripeAlong) },
    keyframeAnimation: [
      {
        duration,
        loop: true,
        delay: phaseMs,
        keyframes,
      },
    ],
  }
}

/** Pols de feix al llarg d'un traç corba: rectangle orientat amb el mateix motiu. */
function pathSweepPulse(
  pathData: string,
  crossSpan: number,
  laneCount: number,
  strandPx: number,
  color: string,
  alpha: number,
  phaseMs: number,
  duration: number,
): object | null {
  const totalLen = pathLength(pathData)
  if (totalLen <= 0 || crossSpan < 0.5) return null
  const steps = Math.max(24, Math.ceil(totalLen / 3))
  const keyframes: Array<{
    percent: number
    x: number
    y: number
    rotation: number
    originX: number
    originY: number
    shape: { x: number; y: number; width: number; height: number }
  }> = []
  for (let s = 0; s <= steps; s++) {
    const frac = s / steps
    const { x, y, angle } = pathPointTangent(pathData, frac * totalLen)
    const rot = angle + Math.PI / 2
    keyframes.push({
      percent: frac,
      x,
      y,
      rotation: rot,
      originX: x,
      originY: y,
      shape: {
        x: -crossSpan / 2,
        y: -SWEEP_BAR_THICK / 2,
        width: crossSpan,
        height: SWEEP_BAR_THICK,
      },
    })
  }
  const k0 = keyframes[0]
  return {
    type: 'rect',
    name: PULSE_EL_NAME,
    silent: true,
    x: k0.x,
    y: k0.y,
    rotation: k0.rotation,
    originX: k0.originX,
    originY: k0.originY,
    shape: k0.shape,
    style: { fill: sweepStripeFill(color, alpha, laneCount, strandPx, 'x') },
    keyframeAnimation: [
      {
        duration,
        loop: true,
        delay: phaseMs,
        keyframes,
      },
    ],
  }
}

/** Redirecció d'items entre dues cues (p. ex. derivacions o cua de triatge). */
export interface QueueRedirect {
  fromId: string
  toId: string
  count: number
}

/** Padding horitzontal de la sèrie dins del canvas (px). */
const PAD_X = 24
/** Llargada dels fils d'entrada externa (esvaïts cap amunt, fora de la xarxa). */
const EXT_LEN = 68
/** Gruix de les barres de port (cua i agent): vora del node des d'on surten/arriben els fils. */
const PORT_H = 3
/** Alçada reservada a la banda superior (fils externs + cards de cua + port). */
const QUEUE_CARD_TOP = EXT_LEN + PORT_H
/** Alçada de la card compacta de cua (ha de coincidir amb el CSS). */
const QUEUE_CARD_HEIGHT = 52
/** Mida del ring d'avatar al flux: alçada del títol (fs-sm) + subtítol (fs-2xs). */
const QFLOW_RING_SIZE = 36
/** Amplada de `.qflow__queue-card` (ha de coincidir amb el CSS). */
const QUEUE_CARD_W = 168
/** Mínim espai visible entre cards per a un connector de redirecció lateral. */
const REDIRECT_GUTTER = 48
/** Amplada mínima de l'escenari per cua (abans d'extra per redireccions). */
const STAGE_W_PER_QUEUE = 190
/** Desplaçament vertical per cues sense trànsit extern (només alimentades per redirecció). */
const QUEUE_TIER_STEP = QUEUE_CARD_HEIGHT + PORT_H + 14

function queueTierLayout(tier: number) {
  const cardTop = QUEUE_CARD_TOP + tier * QUEUE_TIER_STEP
  const portTop = cardTop + QUEUE_CARD_HEIGHT
  const connectorTopY = portTop + PORT_H
  const nodeCenterY = cardTop + QUEUE_CARD_HEIGHT / 2
  return { cardTop, portTop, connectorTopY, nodeCenterY }
}
/** Marge inferior de la AgentCard al canvas (ha de coincidir amb el CSS). */
const AGENT_CARD_BOTTOM = 8
/** Alçada de la AgentCard al flux (ha de coincidir amb el CSS). */
const AGENT_CARD_HEIGHT = 76
/** Amplada de `.qflow__agent-card` (ha de coincidir amb el CSS). */
const AGENT_CARD_W = 220
/** Separació mínima extra entre cards d'agent (a més de l'amplada). */
const AGENT_CARD_GUTTER = 28
/** Pitch màxim per ranura al port: separació entre fils (px). */
const MAX_STRAND_PX = 3
/** Separació vertical entre bandes horitzontals de connectors. */
const LANE_GAP = 6
/** Radi màxim dels girs cua → agent (arc circular 90°; més gran = corba més oberta). */
const BUS_BEND_R_MAX = 32

/** Radi de gir del bus segons l'offset horitzontal cua → agent. */
function busBendRadius(dx: number): number {
  return Math.min(BUS_BEND_R_MAX, Math.abs(dx) * 0.48)
}

let probeCtx: CanvasRenderingContext2D | null = null
let probePath: SVGPathElement | null = null

/** Longitud d'un path SVG (funciona amb l'element desconnectat del DOM). */
function pathLength(d: string): number {
  probePath ??= document.createElementNS('http://www.w3.org/2000/svg', 'path')
  probePath.setAttribute('d', d)
  return probePath.getTotalLength()
}

/** Normalitza qualsevol color CSS (oklch, var(--token)…) a rgb/hex, que és
    el que el parser de zrender entén. */
function resolveCssColor(color: string): string {
  let value = color
  if (value.startsWith('var(')) {
    const name = value.slice(4, -1).split(',')[0].trim()
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }
  probeCtx ??= document.createElement('canvas').getContext('2d')
  if (!probeCtx) return value
  probeCtx.fillStyle = '#000'
  probeCtx.fillStyle = value
  return probeCtx.fillStyle
}

/** Afegeix alfa a un color opac en qualsevol format habitual (#rrggbb,
    rgb(...), oklch(...)). Chrome modern serialitza els colors del probe-canvas
    en el seu espai original (p. ex. oklch), així que no podem assumir hex. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
    return `${color}${a}`
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (color.endsWith(')') && !color.includes('/')) {
    return color.replace(/\)$/, ` / ${alpha})`)
  }
  return color
}

/** Longituds per segment d'un fil ortogonal (cable-bus). */
interface BusSegments {
  vert1: number
  bend1: number
  horiz: number
  bend2: number
  vert2: number
}

type StrandGeometry = { kind: 'straight'; length: number } | { kind: 'bus'; segs: BusSegments }

function strandTotal(geom: StrandGeometry): number {
  if (geom.kind === 'straight') return geom.length
  const s = geom.segs
  return s.vert1 + s.bend1 + s.horiz + s.bend2 + s.vert2
}

/** Distàncies acumulades als límits de cada segment (inclou 0 al start). */
function strandCumulative(geom: StrandGeometry): number[] {
  if (geom.kind === 'straight') return [0, geom.length]
  const s = geom.segs
  let acc = 0
  const out = [0]
  for (const key of ['vert1', 'bend1', 'horiz', 'bend2', 'vert2'] as const) {
    acc += s[key]
    out.push(acc)
  }
  return out
}

/** sweep SVG: ¼ de circumferència tangent (convexa) als dos trams.
    Confirmats: E-S=1, W-S=0, S-W=1, S-E=0 (coords pantalla, y+ avall). */
function cornerSweep(
  inDir: 'E' | 'W' | 'S' | 'N',
  outDir: 'E' | 'W' | 'S' | 'N',
): 0 | 1 {
  const table: Record<string, 0 | 1> = {
    'E-S': 1,
    'W-S': 0,
    'S-W': 1,
    'S-E': 0,
    'E-N': 0,
    'W-N': 1,
    'N-W': 0,
    'N-E': 1,
  }
  return table[`${inDir}-${outDir}`] ?? 0
}

/** Fil cua → agent; retorna el traç i les longituds per segment. */
function queueAgentStrand(
  topY: number,
  botY: number,
  sx: number,
  tx: number,
  ly: number,
  dir: number,
  r1: number,
  r2: number,
): { pathData: string; geom: StrandGeometry } {
  if (Math.abs(tx - sx) < 2) {
    return {
      pathData: `M ${sx} ${topY} L ${sx} ${botY}`,
      geom: { kind: 'straight', length: botY - topY },
    }
  }
  /* Cada colze té el seu sweep: abans es reutilitzava el mateix i el
     primer (S→H) quedava còncau / al revés. */
  const hDir = dir > 0 ? 'E' : 'W'
  const sweep1 = cornerSweep('S', hDir)
  const sweep2 = cornerSweep(hDir, 'S')
  const bend1 = `A ${r1} ${r1} 0 0 ${sweep1} ${sx + dir * r1} ${ly}`
  const bend2 = `A ${r2} ${r2} 0 0 ${sweep2} ${tx} ${ly + r2}`
  const pathData = [
    `M ${sx} ${topY}`,
    `L ${sx} ${ly - r1}`,
    bend1,
    `L ${tx - dir * r2} ${ly}`,
    bend2,
    `L ${tx} ${botY}`,
  ].join(' ')
  return {
    pathData,
    geom: {
      kind: 'bus',
      segs: {
        vert1: pathLength(`M ${sx} ${topY} L ${sx} ${ly - r1}`),
        bend1: pathLength(`M ${sx} ${ly - r1} ${bend1}`),
        horiz: pathLength(`M ${sx + dir * r1} ${ly} L ${tx - dir * r2} ${ly}`),
        bend2: pathLength(`M ${tx - dir * r2} ${ly} ${bend2}`),
        vert2: pathLength(`M ${tx} ${ly + r2} L ${tx} ${botY}`),
      },
    },
  }
}

/** Fil de redirecció cua → cua entre ranures dels ports laterals.
    Si les cues estan a tiers diferents: horitzontal → corba → vertical →
    corba → horitzontal, cada corba tangent a les dues direccions (com
    `queueAgentStrand` però transposat). El reordenament Y↔X dels carrils
    l'absorbeix la pròpia corba: cada carril té el seu X vertical, triat
    perquè els arcs quedin niats sense creuar-se. */
function redirectStrand(
  fx: number,
  tx: number,
  yFrom: number,
  yTo: number,
  laneIdx: number,
  laneCount: number,
  strandPx: number,
): { pathData: string; geom: StrandGeometry } {
  if (Math.abs(yFrom - yTo) < 0.5) {
    return {
      pathData: `M ${fx} ${yFrom} L ${tx} ${yTo}`,
      geom: { kind: 'straight', length: Math.abs(tx - fx) },
    }
  }

  const gutterX = (fx + tx) / 2
  const hSign = Math.sign(tx - fx) || 1
  const vSign = Math.sign(yTo - yFrom) || 1
  /* El carril de dins del gir queda a dins a tots dos trams (cap creuament). */
  const off = (laneIdx - (laneCount - 1) / 2) * strandPx
  const vx = gutterX - hSign * vSign * off
  const halfSpan = ((laneCount - 1) / 2) * strandPx

  const r = Math.min(
    12,
    Math.abs(gutterX - fx) - halfSpan - 0.5,
    Math.abs(tx - gutterX) - halfSpan - 0.5,
    Math.abs(yTo - yFrom) / 2 - 0.5,
  )

  if (r < 1) {
    const pathData = `M ${fx} ${yFrom} L ${vx} ${yFrom} L ${vx} ${yTo} L ${tx} ${yTo}`
    return { pathData, geom: { kind: 'straight', length: pathLength(pathData) } }
  }

  /* sweep=1 és horari en coords de pantalla; el gir H→V és horari quan
     hSign i vSign coincideixen, i el V→H és sempre l'oposat. */
  const sweep1 = hSign * vSign > 0 ? 1 : 0
  const sweep2 = 1 - sweep1
  const pathData = [
    `M ${fx} ${yFrom}`,
    `L ${vx - hSign * r} ${yFrom}`,
    `A ${r} ${r} 0 0 ${sweep1} ${vx} ${yFrom + vSign * r}`,
    `L ${vx} ${yTo - vSign * r}`,
    `A ${r} ${r} 0 0 ${sweep2} ${vx + hSign * r} ${yTo}`,
    `L ${tx} ${yTo}`,
  ].join(' ')

  return { pathData, geom: { kind: 'straight', length: pathLength(pathData) } }
}

interface FlowEdge {
  from: number
  to: number
  count: number
}

/** Amplada/alçada d'un port segons carrils paral·lels. */
function portSpan(lanes: number, strandPx: number): number {
  return lanes * strandPx
}

function edgeSides(
  e: FlowEdge,
  queues: Array<{ centerFraction: number; nodeCenterY: number }>,
): { fromSide: 'left' | 'right'; toSide: 'left' | 'right' } {
  const toRight = queues[e.to].centerFraction > queues[e.from].centerFraction
  return { fromSide: toRight ? 'right' : 'left', toSide: toRight ? 'left' : 'right' }
}

/** Top-Y del port lateral d'una aresta (apilat amb altres del mateix costat). */
function lateralPortTop(
  node: number,
  side: 'left' | 'right',
  edgeIdx: number,
  edges: FlowEdge[],
  queues: Array<{ centerFraction: number; nodeCenterY: number }>,
  strandPx: number,
  role: 'from' | 'to',
): number {
  const siblings = edges
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => {
      const { fromSide, toSide } = edgeSides(e, queues)
      return role === 'from' ? e.from === node && fromSide === side : e.to === node && toSide === side
    })
  const total = siblings.reduce((s, { e }) => s + e.count, 0)
  const stackTop = queues[node].nodeCenterY - portSpan(total, strandPx) / 2
  let cursor = stackTop
  for (const { e, idx } of siblings) {
    if (idx === edgeIdx) return cursor
    cursor += portSpan(e.count, strandPx)
  }
  return stackTop
}

function lateralPortRect(
  node: number,
  side: 'left' | 'right',
  edgeIdx: number,
  laneCount: number,
  edges: FlowEdge[],
  queues: Array<{ centerFraction: number; nodeCenterY: number }>,
  strandPx: number,
  role: 'from' | 'to',
  cardCenterX: (v: number) => number,
) {
  const top = lateralPortTop(node, side, edgeIdx, edges, queues, strandPx, role)
  const cardX = cardCenterX(node) + (side === 'left' ? -QUEUE_CARD_W / 2 : QUEUE_CARD_W / 2)
  return {
    x: side === 'right' ? cardX : cardX - PORT_H,
    y: top,
    width: PORT_H,
    height: portSpan(laneCount, strandPx),
  }
}

/** Distància sincronitzada al llarg del carril quan el ref ha avançat `refDist` px.
    Als trams verticals/horitzontals compartim la mateixa Δ absoluta (barra rígida);
    a les corbes, proporcional dins del segment. */
function syncedStrandDist(
  refGeom: StrandGeometry,
  strandGeom: StrandGeometry,
  refDist: number,
): number {
  if (refGeom.kind === 'straight' && strandGeom.kind === 'straight') {
    return Math.min(refDist, strandGeom.length)
  }
  if (refGeom.kind !== 'bus' || strandGeom.kind !== 'bus') {
    const refTotal = strandTotal(refGeom)
    const strandLen = strandTotal(strandGeom)
    return refTotal > 0 ? Math.min((refDist / refTotal) * strandLen, strandLen) : 0
  }

  const refCum = strandCumulative(refGeom)
  const strandCum = strandCumulative(strandGeom)
  const refTotal = refCum[refCum.length - 1]
  refDist = Math.max(0, Math.min(refDist, refTotal))

  let seg = 0
  while (seg < refCum.length - 2 && refDist > refCum[seg + 1]) seg++

  const segKind = (['vert1', 'bend1', 'horiz', 'bend2', 'vert2'] as const)[seg]
  const refSegDist = refDist - refCum[seg]
  const refSegLen = refCum[seg + 1] - refCum[seg]
  const strandSegLen = strandCum[seg + 1] - strandCum[seg]

  if (segKind === 'vert1' || segKind === 'vert2' || segKind === 'horiz') {
    return strandCum[seg] + Math.min(refSegDist, strandSegLen)
  }

  const segFrac = refSegLen > 0 ? refSegDist / refSegLen : 0
  return strandCum[seg] + segFrac * strandSegLen
}

/** Keyframes d'offset sincronitzats geomètricament (mateixa Y/X als trams rectes). */
function pulseKeyframes(
  refGeom: StrandGeometry,
  strandGeom: StrandGeometry,
  travelDist: number,
): { percent: number; lineDashOffset: number }[] {
  const refTotal = strandTotal(refGeom)
  if (refTotal <= 0 || travelDist <= 0) return [{ percent: 0, lineDashOffset: 0 }]

  const needsDenseSync =
    refGeom.kind === 'bus' &&
    strandGeom.kind === 'bus' &&
    (refGeom.segs.vert1 !== strandGeom.segs.vert1 ||
      refGeom.segs.vert2 !== strandGeom.segs.vert2 ||
      refGeom.segs.horiz !== strandGeom.segs.horiz)

  const steps =
    refGeom.kind === 'straight' && strandGeom.kind === 'straight'
      ? 2
      : needsDenseSync
        ? 32
        : Math.max(16, Math.ceil(travelDist / 4))

  const keyframes: { percent: number; lineDashOffset: number }[] = []
  for (let s = 0; s <= steps; s++) {
    const frac = s / steps
    keyframes.push({
      percent: frac,
      lineDashOffset: -syncedStrandDist(refGeom, strandGeom, frac * travelDist),
    })
  }
  return keyframes
}

/** Durada del cicle de pols per a una longitud de traç (velocitat constant en px). */
function pulseDuration(pathLen: number, pxPerMs: number, minMs: number, maxMs: number): number {
  if (pathLen <= 0) return minMs
  return Math.round(Math.min(maxMs, Math.max(minMs, pathLen / pxPerMs)))
}

function estimatedPlotW(queueCount: number, redirectCount: number): number {
  const stageW = queueCount * STAGE_W_PER_QUEUE + redirectCount * (QUEUE_CARD_W + REDIRECT_GUTTER)
  return Math.max(stageW - 2 * PAD_X, 320)
}

/** Separa centres de cues connectades per redirecció perquè el connector
    lateral quedi visible entre les cards (no darrere el seu cos). */
function spreadCentersForRedirects(
  centers: number[],
  spanUnits: number,
  edges: Array<{ from: number; to: number }>,
  plotW: number,
): { centers: number[]; spanUnits: number } {
  if (edges.length === 0) return { centers, spanUnits }

  const c = [...centers]
  let span = spanUnits
  const effectivePlotW = plotW > 0 ? plotW : estimatedPlotW(centers.length, edges.length)
  const minCenterPx = QUEUE_CARD_W + REDIRECT_GUTTER
  const m = minCenterPx / effectivePlotW
  if (m >= 1) return { centers, spanUnits }

  for (const e of edges) {
    const left = Math.min(e.from, e.to)
    const right = Math.max(e.from, e.to)
    const gap = c[right] - c[left]
    const delta = (m * span - gap) / (1 - m)
    if (delta > 0.01) {
      for (let k = right; k < c.length; k++) c[k] += delta
      span += delta
    }
  }
  return { centers: c, spanUnits: span }
}

/** Separa centres (fraccions 0..1) perquè N nodes no se solapin: força una
    separació mínima entre centres adjacents mantenint l'ordre d'entrada
    (els centres han d'arribar ordenats ascendentment). Anàloga a
    `spreadCentersForRedirects`, però per a nodes independents en fila. */
function spreadCenters(centers: number[], minGap: number, lo = 0, hi = 1): number[] {
  const n = centers.length
  if (n === 0) return []
  if (n === 1) return [Math.min(Math.max(centers[0], lo), hi)]
  const span = hi - lo
  // No hi caben amb el gap demanat: repartiment uniforme.
  if (minGap * (n - 1) >= span) {
    const gap = span / (n - 1)
    return centers.map((_, i) => lo + i * gap)
  }
  const out = centers.map((c) => Math.min(Math.max(c, lo), hi))
  for (let i = 1; i < n; i++) {
    if (out[i] < out[i - 1] + minGap) out[i] = out[i - 1] + minGap
  }
  // Si l'empenta cap a la dreta ha desbordat, recol·loca cap a l'esquerra.
  if (out[n - 1] > hi) {
    out[n - 1] = hi
    for (let i = n - 2; i >= 0; i--) {
      if (out[i] > out[i + 1] - minGap) out[i] = out[i + 1] - minGap
    }
  }
  return out
}

export function EChartsQueueFlow({
  agents,
  redirects = [],
  queueNames,
  pulseMode = 'per-strand',
}: {
  agents: Agent[]
  redirects?: QueueRedirect[]
  /** Noms per a cues que no existeixen a la caché (p. ex. cues de demo). */
  queueNames?: Record<string, string>
  /** Mode d'animació: dash per fil (SVG), barra transversal (SVG o canvas). */
  pulseMode?: QueueFlowPulseMode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const [plotW, setPlotW] = useState(0)
  const model = useQueueFlowModel(agents, queueNames)

  /* Panning: arrossegar amb el ratolí desplaça el mapa quan és més gran que
     el contenidor (scroll del wrapper). Un clic sense moviment (>4px) es
     comporta com un clic normal — la card de l'agent no es veu afectada. */
  const wrapRef = useRef<HTMLDivElement>(null)
  const panState = useRef<{ x: number; y: number; left: number; top: number; active: boolean } | null>(null)
  const setPanning = (active: boolean) => {
    wrapRef.current?.classList.toggle('qflow--panning', active)
    /* Al renderer canvas no hi ha DOM SVG: amaguem els polsos via zrender. */
    if (pulseMode !== 'canvas') return
    const chart = chartRef.current
    if (!chart) return
    chart.getZr().storage.traverse((el) => {
      if (el.name !== PULSE_EL_NAME) return
      el.ignore = active
    })
    chart.getZr().refreshImmediately()
  }
  const onPanDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !wrapRef.current) return
    const el = wrapRef.current
    panState.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, active: false }
  }
  const onPanMove = (e: React.PointerEvent) => {
    const s = panState.current
    const el = wrapRef.current
    if (!s || !el || e.buttons === 0) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.active && Math.hypot(dx, dy) > 4) {
      s.active = true
      setPanning(true)
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* punter ja no actiu — el pan segueix funcionant sense captura */
      }
    }
    if (s.active) {
      el.scrollLeft = s.left - dx
      el.scrollTop = s.top - dy
    }
  }
  const onPanEnd = (e: React.PointerEvent) => {
    if (panState.current?.active) {
      try {
        wrapRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ídem */
      }
    }
    panState.current = null
    setPanning(false)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const syncPlotW = () => setPlotW(Math.max(el.clientWidth - 2 * PAD_X, 1))
    syncPlotW()
    const observer = new ResizeObserver(syncPlotW)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* Layout lògic: quines cues es veuen, quantes ranures té el port de cada
     una (items a l'agent + redireccions que hi entren o en surten) i a quina
     fracció del plot queda el centre de cada port. Compartit entre el render
     ECharts i les capçaleres HTML superposades. */
  const flow = useMemo(() => {
    const { queues: groups, cell, qTotal, aTotal, total, agents: modelAgents } = model
    const byQueueId = new Map(
      groups.map((g, k) => [g.queueId, k] as const).filter(([id]) => id !== null),
    )
    const edges = redirects
      .map((r) => ({
        from: byQueueId.get(r.fromId),
        to: byQueueId.get(r.toId),
        count: r.count,
      }))
      .filter((e): e is { from: number; to: number; count: number } =>
        e.from !== undefined && e.to !== undefined && e.count > 0,
      )

    const outRed = groups.map((_, k) =>
      edges.filter((e) => e.from === k).reduce((s, e) => s + e.count, 0),
    )
    const inRed = groups.map((_, k) =>
      edges.filter((e) => e.to === k).reduce((s, e) => s + e.count, 0),
    )

    const visibleIdx = groups
      .map((_, k) => k)
      .filter((k) => qTotal[k] + outRed[k] + inRed[k] > 0)
    if (visibleIdx.length === 0 || total === 0) return null

    // Amplada del port en "unitats item" i repartiment horitzontal amb un
    // gap relatiu (les cues, no gaire separades).
    const laneUnits = visibleIdx.map((k) => qTotal[k] + outRed[k] + inRed[k])
    const gapUnits = (1.5 * total) / visibleIdx.length
    let cursor = gapUnits
    const centers = laneUnits.map((u) => {
      const c = cursor + u / 2
      cursor += u + gapUnits
      return c
    })
    const spanUnitsInitial = cursor

    const visPos = new Map(visibleIdx.map((k, v) => [k, v]))
    const visEdgePairs = edges
      .map((e) => ({
        from: visPos.get(e.from)!,
        to: visPos.get(e.to)!,
      }))
      .filter((e): e is { from: number; to: number } => e.from !== undefined && e.to !== undefined)

    const spread = spreadCentersForRedirects(centers, spanUnitsInitial, visEdgePairs, plotW)
    const spanUnits = spread.spanUnits

    const queues = visibleIdx.map((k, v) => {
      const count = qTotal[k]
      const out = outRed[k]
      const inR = inRed[k]
      const ext = Math.max(0, count + out - inR)
      const tier = ext > 0 ? 0 : 1
      const layout = queueTierLayout(tier)
      return {
        group: groups[k],
        count,
        outRed: out,
        inRed: inR,
        ext,
        tier,
        hasExternal: ext > 0,
        cardTop: layout.cardTop,
        connectorTopY: layout.connectorTopY,
        nodeCenterY: layout.nodeCenterY,
        laneUnits: laneUnits[v],
        centerFraction: spread.centers[v] / spanUnits,
        share: Math.round((count / total) * 100),
      }
    })

    // Matriu cua × agent restringida a les cues visibles (alineada amb `queues`).
    const visCell = visibleIdx.map((k) => cell[k])

    const topBandHeight = Math.max(...queues.map((q) => q.connectorTopY))

    const visEdges = edges
      .map((e) => ({
        from: visPos.get(e.from)!,
        to: visPos.get(e.to)!,
        count: e.count,
      }))
      .filter((e): e is { from: number; to: number; count: number } =>
        e.from !== undefined && e.to !== undefined,
      )

    // Centre de cada agent = mitjana ponderada del centre de les cues que
    // l'alimenten (pes = items). Separa'ls després per no encavalcar cards.
    const agentRawCenter = modelAgents.map((_, ai) => {
      let acc = 0
      let w = 0
      queues.forEach((q, v) => {
        const c = visCell[v][ai]
        acc += c * q.centerFraction
        w += c
      })
      return w > 0 ? acc / w : 0.5
    })
    const effPlotW = plotW > 0 ? plotW : estimatedPlotW(visibleIdx.length, visEdges.length)
    const minGapFrac = Math.min(0.9, (AGENT_CARD_W + AGENT_CARD_GUTTER) / effPlotW)
    const agentOrder = modelAgents
      .map((_, ai) => ai)
      .sort((a, b) => agentRawCenter[a] - agentRawCenter[b])
    const spreadAgents = spreadCenters(
      agentOrder.map((ai) => agentRawCenter[ai]),
      minGapFrac,
    )
    const agentCenterFraction: number[] = []
    agentOrder.forEach((ai, k) => {
      agentCenterFraction[ai] = spreadAgents[k]
    })
    const agentsOut = modelAgents.map((agent, ai) => ({
      agent,
      aTotal: aTotal[ai],
      centerFraction: agentCenterFraction[ai],
    }))

    const redirectExtra = visEdges.length * (QUEUE_CARD_W + REDIRECT_GUTTER)
    const stageForQueues = visibleIdx.length * STAGE_W_PER_QUEUE
    const stageForAgents = agentsOut.length * (AGENT_CARD_W + AGENT_CARD_GUTTER)
    const stageMinWidth = Math.max(stageForQueues, stageForAgents) + redirectExtra

    return {
      queues,
      agents: agentsOut,
      cell: visCell,
      edges: visEdges,
      total,
      stageMinWidth,
      topBandHeight,
    }
  }, [model, redirects, plotW])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = echarts.init(el, undefined, { renderer: echartsRenderer(pulseMode) })
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [pulseMode])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !flow) return
    const { queues, agents: fAgents, cell, edges, total } = flow

    const agentColors = fAgents.map(({ agent }) => resolveCssColor(colorFromRecordId(agent.id)))
    const queueColors = queues.map(({ group }) => resolveCssColor(flowGroupColor(group)))

    /* Ordre canònic dels feixos (cua, agent) amb items: fixa l'ordre dels
       dataItems de la sèrie i és compartit amb el `renderItem` per indexar-los. */
    const bundleIndex: Array<{ qi: number; ai: number; count: number }> = []
    for (let qi = 0; qi < queues.length; qi++) {
      for (let ai = 0; ai < fAgents.length; ai++) {
        const c = cell[qi][ai]
        if (c > 0) bundleIndex.push({ qi, ai, count: c })
      }
    }

    /* Pols de flux: un cicle de dash per bucle (gap < longitud del feix amb densitat
       alta). Keyframes geomètrics als trams rectes per mantenir la barra alineada
       entre carrils paral·lels de longitud diferent. */
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const strandDense = pulseMode === 'per-strand'
    /* Intensitat: border del node ~10% (CSS) < connector < pols. */
    const PORT_ALPHA = 0.52
    const LANE_ALPHA = 0.34
    const PULSE_ALPHA = 0.76
    const PULSE_LEN = strandDense ? 9 : 10
    const PULSE_PX_PER_MS = strandDense ? 0.13 : 0.11
    const PULSE_DURATION_MIN = strandDense ? 1600 : 1800
    const PULSE_DURATION_MAX = strandDense ? 8000 : 9000
    const pulseDur = (pathLen: number) =>
      pulseDuration(pathLen, PULSE_PX_PER_MS, PULSE_DURATION_MIN, PULSE_DURATION_MAX)
    const PULSE_PHASE_STEP = strandDense ? 120 : 150
    const pulseDash = (bundleMaxLen: number) => {
      const gap = Math.max(40, bundleMaxLen * (strandDense ? 0.45 : 0.55))
      return [PULSE_LEN, gap]
    }
    const pulseCycle = (bundleMaxLen: number) => {
      const dash = pulseDash(bundleMaxLen)
      return dash[0] + dash[1]
    }
    const bundleSweep = pulseMode !== 'per-strand'
    const strandPulse = pulseMode === 'per-strand'

    const pulse = (
      pathData: string,
      color: string,
      strokeW: number,
      phaseMs: number,
      refGeom: StrandGeometry,
      strandGeom: StrandGeometry,
      bundleMaxLen: number,
    ): object | null => {
      if (reducedMotion || strandTotal(refGeom) <= 0) return null
      const cycle = pulseCycle(bundleMaxLen)
      const animTravel = Math.min(cycle, strandTotal(refGeom))
      const keyframes = pulseKeyframes(refGeom, strandGeom, animTravel).map(
        ({ percent, lineDashOffset }) => ({
          percent,
          style: { lineDashOffset },
        }),
      )
      return {
        type: 'path',
        name: PULSE_EL_NAME,
        silent: true,
        shape: { pathData },
        style: {
          fill: 'none',
          stroke: withAlpha(color, PULSE_ALPHA),
          lineWidth: strokeW,
          lineDash: pulseDash(bundleMaxLen),
        },
        keyframeAnimation: [
          {
            duration: pulseDur(animTravel),
            loop: true,
            delay: phaseMs,
            keyframes,
          },
        ],
      }
    }

    chart.setOption(
      {
        series: [
          {
            type: 'custom',
            coordinateSystem: 'none',
            silent: true,
            emphasis: { disabled: true },
            renderItem: (
              params: { dataIndex: number },
              api: { getWidth: () => number; getHeight: () => number },
            ) => {
              const plotW = api.getWidth() - 2 * PAD_X
              const chartTopY = Math.max(...queues.map((q) => q.connectorTopY))
              const botY = api.getHeight() - AGENT_CARD_BOTTOM - AGENT_CARD_HEIGHT - PORT_H
              const midY = (chartTopY + botY) / 2
              const strandPx = Math.min(MAX_STRAND_PX, plotW / (3 * total))
              const queueTopY = (v: number) => queues[v].connectorTopY
              const laneOriginX = (origin: number, slot: number) => origin + (slot + 0.5) * strandPx

              /* Cada port (cua a dalt, agent a baix, lateral) només cobreix els
                 carrils que serveix — no comparteixen una barra horitzontal única. */
              const cardCenterXQ = (qi: number) => PAD_X + queues[qi].centerFraction * plotW
              const cardCenterXA = (ai: number) => PAD_X + fAgents[ai].centerFraction * plotW
              const queuePortX0 = (qi: number) =>
                cardCenterXQ(qi) - portSpan(queues[qi].count, strandPx) / 2
              const agentPortX0 = (ai: number) =>
                cardCenterXA(ai) - portSpan(fAgents[ai].aTotal, strandPx) / 2

              /* Ordenació de subcarrils (mínims creuaments al bipartit per capes):
                 dins del port d'una cua, els agents van d'esquerra a dreta per la
                 seva x; dins del port d'un agent, les cues per la seva x. */
              const agentOrderByX = fAgents
                .map((_, ai) => ai)
                .sort((a, b) => fAgents[a].centerFraction - fAgents[b].centerFraction)
              const queueOrderByX = queues
                .map((_, qi) => qi)
                .sort((a, b) => queues[a].centerFraction - queues[b].centerFraction)
              // Offset (unitats item) de cada subllesca dins del seu port.
              const queueSliceStart = queues.map((_, qi) => {
                const starts: number[] = []
                let cur = 0
                for (const ai of agentOrderByX) {
                  starts[ai] = cur
                  cur += cell[qi][ai]
                }
                return starts
              })
              const agentSliceStart = fAgents.map((_, ai) => {
                const starts: number[] = []
                let cur = 0
                for (const qi of queueOrderByX) {
                  starts[qi] = cur
                  cur += cell[qi][ai]
                }
                return starts
              })

              // Una banda horitzontal per feix, apilades i ordenades per x d'origen.
              const laneKey = (qi: number, ai: number) => qi * fAgents.length + ai
              const laneOrder = bundleIndex
                .map(({ qi, ai, count }) => ({
                  key: laneKey(qi, ai),
                  count,
                  sourceCenterX: queuePortX0(qi) + (queueSliceStart[qi][ai] + count / 2) * strandPx,
                }))
                .sort((a, b) => a.sourceCenterX - b.sourceCenterX)
              const laneCenter = new Map<number, number>()
              let laneCursor = 0
              let prevLaneW = 0
              laneOrder.forEach((b, pos) => {
                const w = b.count * strandPx
                if (pos > 0) laneCursor += prevLaneW / 2 + w / 2 + LANE_GAP
                laneCenter.set(b.key, laneCursor)
                prevLaneW = w
              })
              const lanesSpan = laneCursor

              /** X exterior del port lateral d'una cua (redireccions). */
              const cardLateralX = (v: number, side: 'left' | 'right') =>
                cardCenterXQ(v) + (side === 'left' ? -QUEUE_CARD_W / 2 : QUEUE_CARD_W / 2)
              const lateralPortOuterX = (v: number, side: 'left' | 'right') =>
                cardLateralX(v, side) + (side === 'right' ? PORT_H : -PORT_H)

              const i = params.dataIndex
              const bundleCount = bundleIndex.length
              const queueBase = bundleCount
              const edgeBase = bundleCount + queues.length

              /* ── Feix cua → agent (un dataItem per parella amb items) ── */
              if (i < bundleCount) {
                const { qi, ai, count } = bundleIndex[i]
                const color = queueColors[qi]
                const children: object[] = []
                const topY = queueTopY(qi)
                const sourceX0 = queuePortX0(qi) + queueSliceStart[qi][ai] * strandPx
                const targetX0 = agentPortX0(ai) + agentSliceStart[ai][qi] * strandPx
                const dx = targetX0 - sourceX0
                const dir = Math.sign(dx)
                const r = busBendRadius(dx)
                const strokeW = strandPx * (2 / 3)
                const laneY = midY - lanesSpan / 2 + (laneCenter.get(laneKey(qi, ai)) ?? 0)

                const strandPaths: { pathData: string; geom: StrandGeometry }[] = []
                for (let j = 0; j < count; j++) {
                  const off = (j - (count - 1) / 2) * strandPx
                  const sx = laneOriginX(sourceX0, j)
                  const tx = laneOriginX(targetX0, j)
                  if (Math.abs(dx) < 2) {
                    strandPaths.push({
                      pathData: `M ${sx} ${topY} L ${sx} ${botY}`,
                      geom: { kind: 'straight', length: botY - topY },
                    })
                  } else {
                    // Cada carril manté el seu ly al tram horitzontal (separació
                    // perpendicular al flux); radi compartit per evitar creuaments.
                    const ly = laneY - dir * off
                    strandPaths.push(queueAgentStrand(topY, botY, sx, tx, ly, dir, r, r))
                  }
                }
                const refGeom = strandPaths[Math.floor((count - 1) / 2)].geom
                const bundleMaxLen = Math.max(...strandPaths.map(({ geom }) => strandTotal(geom)))
                strandPaths.forEach(({ pathData, geom }) => {
                  children.push({
                    type: 'path',
                    shape: { pathData },
                    style: { fill: 'none', stroke: withAlpha(color, LANE_ALPHA), lineWidth: strokeW },
                  })
                  if (!strandPulse) return
                  const p = pulse(pathData, color, strokeW, i * PULSE_PHASE_STEP, refGeom, geom, bundleMaxLen)
                  if (p) children.push(p)
                })
                if (bundleSweep && !reducedMotion) {
                  const crossSpan = portSpan(count, strandPx)
                  const crossHalf = crossSpan / 2
                  const phase = i * PULSE_PHASE_STEP
                  const bundleCx = sourceX0 + crossHalf
                  if (Math.abs(dx) < 2) {
                    const sweep = straightSweepPulse(
                      'y',
                      topY,
                      botY,
                      bundleCx - crossHalf,
                      bundleCx + crossHalf,
                      count,
                      strandPx,
                      color,
                      PULSE_ALPHA,
                      phase,
                      pulseDur(botY - topY),
                    )
                    if (sweep) children.push(sweep)
                  } else {
                    const refPath = strandPaths[bundleRefIndex(count)].pathData
                    const sweep = pathSweepPulse(
                      refPath,
                      crossSpan,
                      count,
                      strandPx,
                      color,
                      PULSE_ALPHA,
                      phase,
                      pulseDur(bundleMaxLen),
                    )
                    if (sweep) children.push(sweep)
                  }
                }

                // Subllesca del port de la cua (a dalt) i de l'agent (a baix).
                children.push({
                  type: 'rect',
                  shape: {
                    x: sourceX0,
                    y: topY - PORT_H,
                    width: portSpan(count, strandPx),
                    height: PORT_H,
                  },
                  style: { fill: withAlpha(color, PORT_ALPHA) },
                })
                children.push({
                  type: 'rect',
                  shape: {
                    x: targetX0,
                    y: botY,
                    width: portSpan(count, strandPx),
                    height: PORT_H,
                  },
                  style: { fill: withAlpha(agentColors[ai], PORT_ALPHA) },
                })

                return { type: 'group', children }
              }

              /* ── Entrada externa d'una cua (un dataItem per cua) ──────── */
              if (i < edgeBase) {
                const qi = i - queueBase
                const q = queues[qi]
                const color = queueColors[qi]
                const children: object[] = []

                /* Entrada externa: la part del trànsit sortint que NO ve
                   d'una altra cua arriba de DALT del node (fora de la
                   xarxa): fils esvaïts cap amunt que baixen fins a un port
                   d'entrada situat per sobre de la capçalera de la cua. */
                const ext = q.ext
                if (ext > 0) {
                  const strokeW = strandPx * (2 / 3)
                  const extPortX0 = cardCenterXQ(qi) - portSpan(ext, strandPx) / 2
                  const extPathEnd = EXT_LEN + PORT_H
                  // Gradient en coordenades ABSOLUTES (global): amb
                  // objectBoundingBox, una línia vertical té bbox d'amplada
                  // zero i SVG no la pinta gens.
                  /* Gradient cap a transparent: la part superior es queda
                     esvaïda més llarga; l'opacitat només puja a prop del port. */
                  const fade = (alpha: number) => ({
                    type: 'linear',
                    x: 0,
                    y: 2,
                    x2: 0,
                    y2: EXT_LEN,
                    global: true,
                    colorStops: [
                      { offset: 0, color: withAlpha(color, 0) },
                      { offset: 0.55, color: withAlpha(color, 0) },
                      { offset: 0.82, color: withAlpha(color, alpha * 0.35) },
                      { offset: 1, color: withAlpha(color, alpha) },
                    ],
                  })
                  // Port d'entrada, sobre la capçalera.
                  children.push({
                    type: 'rect',
                    shape: {
                      x: extPortX0,
                      y: EXT_LEN,
                      width: portSpan(ext, strandPx),
                      height: PORT_H,
                    },
                    style: { fill: withAlpha(color, PORT_ALPHA) },
                  })
                  for (let j = 0; j < ext; j++) {
                    const x = laneOriginX(extPortX0, j)
                    const extPathLen = extPathEnd - 2
                    const pathData = `M ${x} 2 L ${x} ${extPathEnd}`
                    children.push({
                      type: 'path',
                      shape: { pathData },
                      style: { fill: 'none', stroke: fade(LANE_ALPHA), lineWidth: strokeW },
                    })
                    if (!strandPulse || reducedMotion) continue
                    children.push({
                      type: 'path',
                      name: PULSE_EL_NAME,
                      silent: true,
                      shape: { pathData },
                      style: {
                        fill: 'none',
                        stroke: fade(PULSE_ALPHA),
                        lineWidth: strokeW,
                        lineDash: pulseDash(extPathLen),
                      },
                      keyframeAnimation: [
                        {
                          duration: pulseDur(extPathLen),
                          loop: true,
                          delay: i * PULSE_PHASE_STEP,
                          keyframes: [
                            { percent: 0, style: { lineDashOffset: 0 } },
                            {
                              percent: 1,
                              style: {
                                lineDashOffset: -pulseCycle(extPathLen),
                              },
                            },
                          ],
                        },
                      ],
                    })
                  }
                  if (bundleSweep && !reducedMotion) {
                    const crossSpan = portSpan(ext, strandPx)
                    const sweep = straightSweepPulse(
                      'y',
                      2,
                      extPathEnd,
                      extPortX0,
                      extPortX0 + crossSpan,
                      ext,
                      strandPx,
                      color,
                      PULSE_ALPHA,
                      i * PULSE_PHASE_STEP,
                      pulseDur(extPathEnd - 2),
                    )
                    if (sweep) children.push(sweep)
                  }
                }

                return { type: 'group', children }
              }

              /* ── Redirecció cua → cua (un dataItem per aresta) ───────── */
              const e = edges[i - edgeBase]
              const edgeIdx = i - edgeBase
              const color = queueColors[e.from]
              const strokeW = strandPx * (2 / 3)
              const { fromSide, toSide } = edgeSides(e, queues)
              const fx = lateralPortOuterX(e.from, fromSide)
              const tx = lateralPortOuterX(e.to, toSide)
              const fromPortTop = lateralPortTop(e.from, fromSide, edgeIdx, edges, queues, strandPx, 'from')
              const toPortTop = lateralPortTop(e.to, toSide, edgeIdx, edges, queues, strandPx, 'to')
              const sameRow = Math.abs(queues[e.from].nodeCenterY - queues[e.to].nodeCenterY) < 0.5
              const children: object[] = []

              children.push({
                type: 'rect',
                shape: lateralPortRect(
                  e.from,
                  fromSide,
                  edgeIdx,
                  e.count,
                  edges,
                  queues,
                  strandPx,
                  'from',
                  cardCenterXQ,
                ),
                style: { fill: withAlpha(color, PORT_ALPHA) },
              })
              children.push({
                type: 'rect',
                shape: lateralPortRect(
                  e.to,
                  toSide,
                  edgeIdx,
                  e.count,
                  edges,
                  queues,
                  strandPx,
                  'to',
                  cardCenterXQ,
                ),
                style: { fill: withAlpha(queueColors[e.to], PORT_ALPHA) },
              })

              const strandPaths: { pathData: string; geom: StrandGeometry }[] = []
              for (let j = 0; j < e.count; j++) {
                const yFrom = fromPortTop + (j + 0.5) * strandPx
                const yTo = toPortTop + (j + 0.5) * strandPx
                strandPaths.push(redirectStrand(fx, tx, yFrom, yTo, j, e.count, strandPx))
              }
              const refGeom = strandPaths[Math.floor((e.count - 1) / 2)].geom
              const bundleMaxLen = Math.max(
                ...strandPaths.map(({ geom }) => strandTotal(geom)),
              )
              strandPaths.forEach(({ pathData, geom }) => {
                children.push({
                  type: 'path',
                  shape: { pathData },
                  style: { fill: 'none', stroke: withAlpha(color, LANE_ALPHA), lineWidth: strokeW },
                })
                if (!strandPulse) return
                const p = pulse(pathData, color, strokeW, i * PULSE_PHASE_STEP, refGeom, geom, bundleMaxLen)
                if (p) children.push(p)
              })
              if (bundleSweep && !reducedMotion) {
                const crossSpan = portSpan(e.count, strandPx)
                const phase = i * PULSE_PHASE_STEP
                if (sameRow) {
                  const x0 = Math.min(fx, tx)
                  const x1 = Math.max(fx, tx)
                  const sweep = straightSweepPulse(
                    'x',
                    x0,
                    x1,
                    fromPortTop,
                    fromPortTop + crossSpan,
                    e.count,
                    strandPx,
                    color,
                    PULSE_ALPHA,
                    phase,
                    pulseDur(bundleMaxLen),
                  )
                  if (sweep) children.push(sweep)
                } else {
                  const refPath = strandPaths[bundleRefIndex(e.count)].pathData
                  const sweep = pathSweepPulse(
                    refPath,
                    crossSpan,
                    e.count,
                    strandPx,
                    color,
                    PULSE_ALPHA,
                    phase,
                    pulseDur(bundleMaxLen),
                  )
                  if (sweep) children.push(sweep)
                }
              }
              return { type: 'group', children }
            },
            data: [
              ...bundleIndex.map(({ qi, ai, count }) => ({
                name: `${queues[qi].group.name} → ${fAgents[ai].agent.name}`,
                value: count,
              })),
              ...queues.map(({ group, ext }) => ({
                name: group.name,
                value: ext,
              })),
              ...edges.map((e) => ({
                name: `${queues[e.from].group.name} → ${queues[e.to].group.name}`,
                value: e.count,
              })),
            ],
          },
        ],
      },
      { notMerge: true },
    )
  }, [flow, pulseMode])

  return (
    <div
      ref={wrapRef}
      className="qflow"
      onPointerDown={onPanDown}
      onPointerMove={onPanMove}
      onPointerUp={onPanEnd}
      onPointerCancel={onPanEnd}
    >
      <div
        className="qflow__echarts-stage"
        style={{ minWidth: flow?.stageMinWidth }}
      >
        <div ref={containerRef} className="qflow__echarts-canvas" />

        {/* Nodes de cua: card compacta (flux del chart, no la QueueCard del panell) */}
        {flow && (
          <div className="qflow__queues" style={{ left: PAD_X, right: PAD_X, height: flow.topBandHeight }}>
            {flow.queues.map(({ group, centerFraction, share, count, outRed, cardTop, hasExternal }) => (
              <div
                key={group.key}
                className={`qflow__queue-card${hasExternal ? ' qflow__queue-card--origin' : ' qflow__queue-card--derived'}`}
                style={{ left: `${centerFraction * 100}%`, top: cardTop }}
              >
                <QueueFlowCard
                  queueId={group.queueId}
                  name={group.name}
                  meta={
                    count > 0
                      ? `${count} ${count === 1 ? 'item' : 'items'} · ${share}%`
                      : `${outRed} redirigits`
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Nodes de la gent: una AgentCard per agent, col·locada per la seva fracció */}
        {flow && (
          <div className="qflow__agents" style={{ left: PAD_X, right: PAD_X, height: AGENT_CARD_HEIGHT }}>
            {flow.agents.map(({ agent, centerFraction }) => (
              <div
                key={agent.id}
                className="qflow__agent-card"
                style={
                  {
                    left: `${centerFraction * 100}%`,
                    '--qflow-node-color': colorFromRecordId(agent.id),
                  } as CSSProperties
                }
              >
                <AgentCard agent={agent} showCapacityHead={false} ringSize={QFLOW_RING_SIZE} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
