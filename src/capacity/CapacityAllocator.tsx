import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { AppIcon, Chip, SfIcon } from '../components/ds'
import { computeDynRanges, computeHardRanges, moveTo } from './allocator-engine'
import { useEasedVector } from './use-eased-vector'
import {
  arcAt,
  axisAngle,
  axisPt,
  annulus,
  agentsToRadarCssPx,
  clientToSvg,
  CENTER,
  computeChartViewBox,
  dividerEnds,
  fitRadarLayout,
  fromView,
  axisUnit,
  labelAnchorRadius,
  labelTextAnchor,
  RADAR_DISK_SCALE,
  magneticSnapAgents,
  MAGNETIC_SNAP_MAX_PX,
  radarContentBounds,
  RADIUS,
  smoothClosed,
  svgCssScale,
  toView,
} from './allocator-geometry'
import type { AllocatorQueue, AllocatorView, SkillProfile } from './allocator-types'

export type CapacityAllocatorProps = {
  queues: AllocatorQueue[]
  profiles: SkillProfile[]
  total: number
  value: number[]
  onChange: (next: number[]) => void
  locked: boolean[]
  onLockedChange: (next: boolean[]) => void
  defaultView?: AllocatorView
  defaultPerQueueScale?: boolean
}

const STRINGS = {
  viewAreas: 'Areas',
  viewLines: 'Lines',
  viewSliders: 'Sliders',
  scalePerQueue: 'Per-queue scale',
  hintAreas: 'Drag the outer edge of a slice.',
  hintLines: "Drag a queue's vertex.",
  hintSliders: 'Move a slider — the other queues rebalance agent by agent.',
  legendAvailable: 'Available headroom',
  legendBlocked: 'Blocked by locked queues',
  legendImpossible: 'Impossible (skills)',
  agentsShort: 'agents',
  lock: (name: string) => `Lock ${name}`,
} as const

type ScaleMode = 'norm' | 'abs'
type Hard = readonly (readonly [number, number])[]
type Dyn = readonly (readonly [number, number])[]

function sliceTint(hue: string, locked: boolean): string {
  if (locked) return 'color-mix(in srgb, var(--text-disabled) 12%, transparent)'
  return `color-mix(in srgb, ${hue} 12%, transparent)`
}

/** Assigned-value wedge fill — stronger than slice tint, softer than solid hue. */
function sliceValueFill(hue: string, locked: boolean): string {
  if (locked) return 'color-mix(in srgb, var(--text-disabled) 32%, transparent)'
  return `color-mix(in srgb, ${hue} 58%, transparent)`
}

/** Subtle per-queue ceiling rim in absolute scale (feasible max, not the value edge). */
function sliceCeilingStroke(hue: string, locked: boolean): string {
  if (locked) return 'color-mix(in srgb, var(--text-disabled) 28%, transparent)'
  return `color-mix(in srgb, ${hue} 38%, transparent)`
}

function sliceCursor(locked: boolean, dragging: boolean): string {
  if (locked) return 'not-allowed'
  if (dragging) return 'grabbing'
  return 'grab'
}

/** Ignore pointer-up commits until the pointer moves at least this far (CSS px). */
const DRAG_THRESHOLD_PX = 3

export function CapacityAllocator({
  queues,
  profiles,
  total,
  value,
  onChange,
  locked,
  onLockedChange,
  defaultView = 'areas',
  defaultPerQueueScale = true,
}: CapacityAllocatorProps) {
  const nQ = queues.length
  const hues = useMemo(() => queues.map((q) => q.hue), [queues])
  const [view, setView] = useState<AllocatorView>(defaultView)
  const [scaleMode, setScaleMode] = useState<ScaleMode>(defaultPerQueueScale ? 'norm' : 'abs')
  const [hoverIdx, setHoverIdx] = useState(-1)
  const [dragIdx, setDragIdx] = useState(-1)
  const [interacting, setInteracting] = useState(false)
  const [dragBaseline, setDragBaseline] = useState<number[]>(() => value.slice())
  /** Continuous preview while dragging — geometry follows the pointer; integers commit on release. */
  const [dragPreview, setDragPreview] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const chartStageRef = useRef<HTMLDivElement>(null)
  const dragPreviewRef = useRef<number | null>(null)
  const dragRangeRef = useRef<readonly [number, number] | null>(null)
  const dragIdxRef = useRef(-1)
  const dragPointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const dragMovedRef = useRef(false)

  const hard = useMemo(
    () => (nQ === 0 ? [] : computeHardRanges(profiles, total, nQ)),
    [profiles, total, nQ],
  )
  const dyn = useMemo(() => {
    if (nQ === 0) return []
    const basis =
      dragIdx >= 0 && dragPreview !== null
        ? moveTo(value, dragIdx, Math.round(dragPreview), locked, profiles, total)
        : value
    return computeDynRanges(basis, locked, profiles, total)
  }, [value, locked, profiles, total, nQ, dragIdx, dragPreview])

  const previewAllocation = useMemo(() => {
    if (dragIdx < 0 || dragPreview === null) return null
    return moveTo(value, dragIdx, Math.round(dragPreview), locked, profiles, total)
  }, [value, dragIdx, dragPreview, locked, profiles, total])

  /** Continuous overlay of the actively-dragged queue on top of the rebalanced integers. */
  const dragOverlay = useMemo(() => {
    if (previewAllocation === null || dragIdx < 0 || dragPreview === null) return null
    const next = previewAllocation.slice()
    next[dragIdx] = dragPreview
    return next
  }, [previewAllocation, dragIdx, dragPreview])

  // Every drawn position is toView(value, hard) — a function of the value AND the
  // scale it is measured against. On a data refresh the ranges shift too, so easing
  // the value alone would leave the scale to jump and the motion would visibly start
  // from the wrong place. Pack value + hard + dyn + total into one vector so they all
  // ease together, on one clock.
  //
  // The live drag overlay is fed in instead of the `value` prop (which only updates on
  // commit) so the hook's position tracks the pointer in real time; otherwise a later
  // animation would start from wherever `value` sat before the drag began.
  const easeInput = useMemo(() => {
    const alloc = dragOverlay ?? value
    const out: number[] = []
    for (let i = 0; i < nQ; i++) out.push(alloc[i])
    for (let i = 0; i < nQ; i++) out.push(hard[i][0], hard[i][1])
    for (let i = 0; i < nQ; i++) out.push(dyn[i][0], dyn[i][1])
    out.push(total)
    return out
  }, [dragOverlay, value, hard, dyn, total, nQ])

  const easedFlat = useEasedVector(easeInput, dragIdx >= 0)

  // A queue count change resizes the vector; until the hook re-seeds, fall back to the
  // raw values rather than reading past the end of the previous (shorter) array.
  const easedFits = easedFlat.length === 5 * nQ + 1

  const easedValue = useMemo(
    () => (easedFits ? easedFlat.slice(0, nQ) : value),
    [easedFits, easedFlat, nQ, value],
  )
  /** Eased scale — geometry only. Interaction math keeps using the true integer ranges. */
  const viewHard = useMemo<Hard>(
    () =>
      easedFits
        ? Array.from({ length: nQ }, (_, i) => [easedFlat[nQ + 2 * i], easedFlat[nQ + 2 * i + 1]] as const)
        : hard,
    [easedFits, easedFlat, nQ, hard],
  )
  const viewDyn = useMemo<Dyn>(
    () =>
      easedFits
        ? Array.from({ length: nQ }, (_, i) => [easedFlat[3 * nQ + 2 * i], easedFlat[3 * nQ + 2 * i + 1]] as const)
        : dyn,
    [easedFits, easedFlat, nQ, dyn],
  )
  const viewTotal = easedFits ? easedFlat[5 * nQ] : total

  /** Geometry: rebalanced integers on other queues; continuous preview on the dragged one. */
  const visualValue = dragOverlay ?? easedValue

  /** Labels / slider readouts: full integer preview allocation while dragging, eased otherwise. */
  const labelValue = previewAllocation ?? easedValue

  const applyMove = useCallback(
    (i: number, target: number) => {
      const next = moveTo(value, i, target, locked, profiles, total)
      if (next.some((v, idx) => v !== value[idx])) onChange(next)
    },
    [value, locked, profiles, total, onChange],
  )

  const toggleLock = useCallback(
    (i: number) => {
      const next = locked.slice()
      next[i] = !next[i]
      onLockedChange(next)
    },
    [locked, onLockedChange],
  )

  const setPreview = useCallback((v: number | null) => {
    dragPreviewRef.current = v
    setDragPreview(v)
  }, [])

  const noteDragMotion = useCallback((clientX: number, clientY: number): boolean => {
    const origin = dragPointerOriginRef.current
    if (!origin) return false
    if (dragMovedRef.current) return true
    if (Math.hypot(clientX - origin.x, clientY - origin.y) >= DRAG_THRESHOLD_PX) {
      dragMovedRef.current = true
      return true
    }
    return false
  }, [])

  const activateDrag = useCallback(() => {
    const i = dragIdxRef.current
    if (i < 0) return
    setDragIdx(i)
    setInteracting(true)
    setDragBaseline(value.slice())
    setPreview(value[i])
  }, [value, setPreview])

  const armDrag = useCallback(
    (i: number, clientX: number, clientY: number) => {
      dragPointerOriginRef.current = { x: clientX, y: clientY }
      dragMovedRef.current = false
      dragIdxRef.current = i
      dragRangeRef.current = dyn[i] ?? ([value[i], value[i]] as const)
    },
    [value, dyn],
  )

  const resetDrag = useCallback(() => {
    dragIdxRef.current = -1
    dragRangeRef.current = null
    dragPointerOriginRef.current = null
    dragMovedRef.current = false
    setPreview(null)
    setDragIdx(-1)
    setInteracting(false)
    setHoverIdx(-1)
  }, [setPreview])

  const commitDrag = useCallback(() => {
    if (dragMovedRef.current) {
      const idx = dragIdxRef.current
      const preview = dragPreviewRef.current
      if (idx >= 0 && preview !== null) {
        applyMove(idx, Math.round(preview))
      }
    }
    resetDrag()
  }, [applyMove, resetDrag])

  const pickQueue = useCallback(
    (mx: number, my: number): number => {
      if (view === 'areas') {
        const dx = mx - CENTER
        const dy = my - CENTER
        const dist = Math.hypot(dx, dy)
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI
        const halfDeg = 180 / nQ
        for (let k = 0; k < nQ; k++) {
          const mid = -90 + (k * 360) / nQ
          const diff = ((deg - mid + 540) % 360) - 180
          if (Math.abs(diff) <= halfDeg && dist <= RADIUS + 22 && !locked[k]) return k
        }
        return -1
      }
      let best = -1
      let bestD = Infinity
      for (let k = 0; k < nQ; k++) {
        // Hit-test against the vertex as DRAWN (eased scale), not where it will
        // settle — otherwise the grab target drifts off the dot mid-animation.
        const p = axisPt(k, toView(k, visualValue[k], scaleMode, viewTotal, viewHard), nQ)
        const d = Math.hypot(mx - p[0], my - p[1])
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      return bestD <= 26 && best >= 0 && !locked[best] ? best : -1
    },
    [view, nQ, locked, visualValue, scaleMode, viewTotal, viewHard],
  )

  const applyDragAt = useCallback(
    (mx: number, my: number, idx: number) => {
      let posPct: number
      if (view === 'areas') {
        posPct = (Math.hypot(mx - CENTER, my - CENTER) / RADIUS) * 100
      } else {
        const a = axisAngle(idx, nQ)
        posPct = (((mx - CENTER) * Math.cos(a) + (my - CENTER) * Math.sin(a)) / RADIUS) * 100
      }
      const raw = fromView(idx, posPct, scaleMode, total, hard)
      const range = dragRangeRef.current
      const lo = range ? range[0] : 0
      const hi = range ? range[1] : total
      const svg = svgRef.current
      const cssPerSvg = svg ? svgCssScale(svg) : 1
      const snapped = magneticSnapAgents(
        raw,
        lo,
        hi,
        (agents) => agentsToRadarCssPx(idx, agents, scaleMode, total, hard, cssPerSvg),
        MAGNETIC_SNAP_MAX_PX,
      )
      setPreview(snapped)
    },
    [view, nQ, scaleMode, total, hard, setPreview],
  )

  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (view === 'sliders') return
    const svg = svgRef.current
    if (!svg) return
    const [mx, my] = clientToSvg(e.clientX, e.clientY, svg)
    const k = pickQueue(mx, my)
    if (k < 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    armDrag(k, e.clientX, e.clientY)
    e.preventDefault()
  }

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const [mx, my] = clientToSvg(e.clientX, e.clientY, svg)
    if (dragIdxRef.current >= 0) {
      if (noteDragMotion(e.clientX, e.clientY)) {
        if (dragIdx < 0) activateDrag()
        applyDragAt(mx, my, dragIdxRef.current)
      }
      e.preventDefault()
      return
    }
    if (view === 'sliders') return
    const k = pickQueue(mx, my)
    if (k !== hoverIdx) setHoverIdx(k)
  }

  const onSvgPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragIdxRef.current >= 0 || interacting) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      commitDrag()
    }
  }

  const onSvgPointerLeave = () => {
    if (dragIdxRef.current < 0) setHoverIdx(-1)
  }

  const chartViewBox = computeChartViewBox()

  const labelNodes = useMemo(
    () =>
      buildLabels({
        queues,
        value: labelValue,
        locked,
        hard,
        nQ,
        interacting,
        dragBaseline,
        onToggleLock: toggleLock,
      }),
    [queues, labelValue, locked, hard, nQ, interacting, dragBaseline, toggleLock],
  )

  // Label blocks are HTML at a fixed font size, so their footprint does not scale
  // with the chart: measure them, then fit the largest disk that still leaves room.
  const queueNamesKey = useMemo(() => queues.map((q) => q.name).join(' '), [queues])

  useLayoutEffect(() => {
    const stage = chartStageRef.current
    if (!stage) return
    const allocator = stage.parentElement
    if (!allocator) return

    const syncChartLayout = () => {
      const availW = allocator.clientWidth
      if (availW <= 0) return

      const els = Array.from(
        stage.querySelectorAll<HTMLElement>('[data-queue-label]'),
      ).sort((a, b) => Number(a.dataset.queueLabel) - Number(b.dataset.queueLabel))

      const boxes = els.map((el, k) => {
        const [ux, uy] = axisUnit(k, els.length)
        return { ux, uy, width: el.offsetWidth, height: el.offsetHeight }
      })

      // Vertical space for the chart only — exclude toolbar, hint, legend and flex gaps.
      const gapPx = 4
      let overhead = 0
      for (const child of allocator.children) {
        if (child === stage) continue
        overhead += (child as HTMLElement).offsetHeight
      }
      const gaps = Math.max(0, allocator.children.length - 1) * gapPx
      const chartAvailH = Math.max(0, allocator.clientHeight - overhead - gaps)
      const effectiveAvailH = chartAvailH > 0 ? chartAvailH : availW * 2

      const { radius } = fitRadarLayout(availW, effectiveAvailH, boxes)
      const bounds = radarContentBounds(boxes, radius)
      const contentW = bounds.maxX - bounds.minX
      const contentH = bounds.maxY - bounds.minY
      // Stage height matches content exactly — position relative to the stage box,
      // not the full allocator (which would push labels past the bottom edge).
      const cx = (availW - contentW) / 2 - bounds.minX
      const cy = -bounds.minY

      stage.style.setProperty('--chart-r', `${radius}px`)
      stage.style.setProperty('--chart-box', `${2 * radius * RADAR_DISK_SCALE}px`)
      stage.style.setProperty('--chart-cx', `${cx}px`)
      stage.style.setProperty('--chart-cy', `${cy}px`)
      stage.style.setProperty('--svg-scale', `${radius / RADIUS}`)
      stage.style.height = `${contentH}px`

      for (let k = 0; k < boxes.length; k++) {
        const r = labelAnchorRadius(boxes[k], radius)
        els[k].style.left = `${cx + boxes[k].ux * r}px`
        els[k].style.top = `${cy + boxes[k].uy * r}px`
      }
    }

    syncChartLayout()
    const ro = new ResizeObserver(syncChartLayout)
    ro.observe(allocator)

    // Label widths are text metrics: re-fit once webfonts land.
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) syncChartLayout()
    })

    return () => {
      live = false
      ro.disconnect()
    }
  }, [view, nQ, queueNamesKey])

  const hint =
    view === 'sliders'
      ? STRINGS.hintSliders
      : [
          view === 'areas' ? STRINGS.hintAreas : STRINGS.hintLines,
          scaleMode === 'norm' ? 'Per-queue scale.' : 'Absolute scale.',
        ].join(' ')

  if (nQ === 0) return null

  return (
    <div className="capacity-allocator">
      <div className="capacity-allocator__toolbar">
        <div className="settings-segmented" role="group" aria-label="View">
          <button
            type="button"
            className={`settings-segmented__btn${view === 'areas' ? ' is-active' : ''}`}
            onClick={() => setView('areas')}
            aria-pressed={view === 'areas'}
          >
            <AppIcon name="chart" size={13} />
            {STRINGS.viewAreas}
          </button>
          <button
            type="button"
            className={`settings-segmented__btn${view === 'lines' ? ' is-active' : ''}`}
            onClick={() => setView('lines')}
            aria-pressed={view === 'lines'}
          >
            <AppIcon name="data_lake_objects" size={13} />
            {STRINGS.viewLines}
          </button>
          <button
            type="button"
            className={`settings-segmented__btn${view === 'sliders' ? ' is-active' : ''}`}
            onClick={() => setView('sliders')}
            aria-pressed={view === 'sliders'}
          >
            <AppIcon name="slider" size={13} />
            {STRINGS.viewSliders}
          </button>
        </div>
        {view !== 'sliders' && (
          <Chip
            active={scaleMode === 'norm'}
            onClick={() => setScaleMode((m) => (m === 'norm' ? 'abs' : 'norm'))}
            aria-pressed={scaleMode === 'norm'}
          >
            {STRINGS.scalePerQueue}
          </Chip>
        )}
      </div>
      <p className="capacity-allocator__hint">{hint}</p>

      {view !== 'sliders' ? (
        <div ref={chartStageRef} className="capacity-allocator__chart-stage">
          <div className="capacity-allocator__chart-disk">
            <svg
              ref={svgRef}
              className={`capacity-allocator__radar${dragIdx >= 0 ? ' is-dragging' : ''}`}
              viewBox={chartViewBox}
              preserveAspectRatio="xMidYMid meet"
              style={{ touchAction: 'none' }}
              onPointerDown={onSvgPointerDown}
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerLeave={onSvgPointerLeave}
              onPointerCancel={onSvgPointerUp}
            >
              {view === 'areas'
                ? renderRose({
                    nQ,
                    value: visualValue,
                    locked,
                    hard: viewHard,
                    dyn: viewDyn,
                    scaleMode,
                    total: viewTotal,
                    hoverIdx,
                    dragIdx,
                    hues,
                  })
                : renderSpokes({
                    nQ,
                    value: visualValue,
                    locked,
                    hard: viewHard,
                    dyn: viewDyn,
                    scaleMode,
                    total: viewTotal,
                    hoverIdx,
                    dragIdx,
                    hues,
                  })}
            </svg>
          </div>
          <div className="capacity-allocator__labels-overlay">{labelNodes}</div>
        </div>
      ) : (
        <SliderRows
          queues={queues}
          value={labelValue}
          locked={locked}
          hard={viewHard}
          dyn={viewDyn}
          total={viewTotal}
          interacting={interacting}
          dragBaseline={dragBaseline}
          onToggleLock={toggleLock}
          onArm={(i, clientX, clientY) => armDrag(i, clientX, clientY)}
          onDragMotion={noteDragMotion}
          onActivate={activateDrag}
          onPreview={(_i, raw, trackWidthPx) => {
            const range = dragRangeRef.current
            const lo = range ? range[0] : 0
            const hi = range ? range[1] : total
            const pxPerAgent = total > 0 ? trackWidthPx / total : 0
            const snapped = magneticSnapAgents(
              raw,
              lo,
              hi,
              (agents) => agents * pxPerAgent,
              MAGNETIC_SNAP_MAX_PX,
            )
            setPreview(snapped)
          }}
          onEnd={() => commitDrag()}
          preview={dragIdx >= 0 ? dragPreview : null}
          previewIndex={dragIdx}
          dragIdx={dragIdx}
        />
      )}

      <div className="capacity-allocator__legend">
        <span className="capacity-allocator__pill capacity-allocator__pill--ok">
          <i />
          {STRINGS.legendAvailable}
        </span>
        <span className="capacity-allocator__pill capacity-allocator__pill--watch">
          <i />
          {STRINGS.legendBlocked}
        </span>
        <span className="capacity-allocator__pill capacity-allocator__pill--off">
          <i />
          {STRINGS.legendImpossible}
        </span>
      </div>
    </div>
  )
}

/* ---------- SVG drawings ---------- */

type DrawArgs = {
  nQ: number
  value: number[]
  locked: boolean[]
  hard: Hard
  dyn: Dyn
  scaleMode: ScaleMode
  total: number
  hoverIdx: number
  dragIdx: number
  hues: string[]
}

/** Skip limit arcs that sit on the chart outer edge — they read as an unwanted ring. */
const OUTER_CHART_VIEW = 99.5
/** Min visual wedge at value 0 so the slice still reads as draggable (view %). */
const MIN_ZERO_SLICE_VIEW = 8

/** Per-slice grid arcs at each integer agent step in the movable range. */
function renderSliceGridArcs(
  k: number,
  nQ: number,
  locked: boolean[],
  hard: Hard,
  dyn: Dyn,
  scaleMode: ScaleMode,
  total: number,
): ReactNode[] {
  const [rawLo, rawHi] = locked[k] ? hard[k] : dyn[k]
  // Bounds arrive eased (fractional) mid-transition; the ticks themselves mark whole
  // agents, so round the loop bounds — positioning still uses the eased scale.
  const lo = Math.round(rawLo)
  const hi = Math.round(rawHi)
  const out: ReactNode[] = []
  for (let agents = lo; agents <= hi; agents++) {
    const viewPos = toView(k, agents, scaleMode, total, hard)
    if (viewPos <= 0.5 || viewPos >= OUTER_CHART_VIEW) continue
    out.push(
      <path
        key={`grid-${k}-${agents}`}
        d={arcAt(k, viewPos, nQ)}
        fill="none"
        className="capacity-allocator__grid"
      />,
    )
  }
  return out
}

function renderLimitArcs(
  k: number,
  nQ: number,
  locked: boolean[],
  hard: Hard,
  dyn: Dyn,
  scaleMode: ScaleMode,
  total: number,
): ReactNode[] {
  const out: ReactNode[] = []
  const [hLo, hHi] = hard[k]
  const hLoView = toView(k, hLo, scaleMode, total, hard)
  const hHiView = toView(k, hHi, scaleMode, total, hard)
  const isSliceOuter = (viewPos: number) =>
    scaleMode === 'abs' && Math.abs(viewPos - hHiView) < 1
  if (hLoView > 0.5) {
    out.push(
      <path key={`hard-lo-${k}`} d={arcAt(k, hLoView, nQ)} className="capacity-allocator__arc-watch" />,
    )
  }
  if (hHiView > hLoView + 0.5 && hHiView < OUTER_CHART_VIEW && !isSliceOuter(hHiView)) {
    out.push(
      <path key={`hard-hi-${k}`} d={arcAt(k, hHiView, nQ)} className="capacity-allocator__arc-watch" />,
    )
  }
  if (!locked[k]) {
    const [dLo, dHi] = dyn[k]
    const dLoView = toView(k, dLo, scaleMode, total, hard)
    const dHiView = toView(k, dHi, scaleMode, total, hard)
    if (dLoView > 0.5) {
      out.push(
        <path key={`dyn-lo-${k}`} d={arcAt(k, dLoView, nQ)} className="capacity-allocator__arc-ok" />,
      )
    }
    if (dHiView > dLoView + 0.5 && dHiView < OUTER_CHART_VIEW && !isSliceOuter(dHiView)) {
      out.push(
        <path key={`dyn-hi-${k}`} d={arcAt(k, dHiView, nQ)} className="capacity-allocator__arc-ok" />,
      )
    }
  }
  return out
}

function renderQueueSpokes(k: number, nQ: number, hues: string[], locked: boolean[]): ReactNode {
  const hue = hues[k]
  const p0 = axisPt(k, 0, nQ)
  const p100 = axisPt(k, 100, nQ)
  return (
    <line
      key={`spoke-${k}`}
      x1={p0[0]}
      y1={p0[1]}
      x2={p100[0]}
      y2={p100[1]}
      className="capacity-allocator__spoke-axis"
      stroke={locked[k] ? 'var(--text-disabled)' : hue}
    />
  )
}

function renderRose({
  nQ,
  value,
  locked,
  hard,
  dyn,
  scaleMode,
  total,
  hoverIdx,
  dragIdx,
  hues,
}: DrawArgs): ReactNode {
  const nodes: ReactNode[] = []
  for (let k = 0; k < nQ; k++) {
    const [dLo] = dyn[k]
    const vPos = toView(k, value[k], scaleMode, total, hard)
    const hue = hues[k]
    const [, hHi] = hard[k]
    const atZero = !locked[k] && value[k] < 0.5
    const fillPos = atZero ? Math.max(vPos, MIN_ZERO_SLICE_VIEW) : vPos
    const edgePos = fillPos
    const bgOuter = scaleMode === 'abs' ? toView(k, hHi, scaleMode, total, hard) : 100
    nodes.push(
      <path key={`bg-${k}`} d={annulus(k, 0, bgOuter, nQ)} fill={sliceTint(hue, !!locked[k])} />,
    )
    nodes.push(...renderSliceGridArcs(k, nQ, locked, hard, dyn, scaleMode, total))
    nodes.push(...renderLimitArcs(k, nQ, locked, hard, dyn, scaleMode, total))
    // Ceiling rim: per-queue color, 1px. In norm mode all rims sit on the chart outer edge.
    if (bgOuter > 0.5) {
      const rimPos = Math.min(100, bgOuter)
      const atChartOuter = rimPos >= OUTER_CHART_VIEW
      if (atChartOuter || Math.abs(vPos - rimPos) > 1) {
        nodes.push(
          <path
            key={`rim-${k}`}
            d={arcAt(k, rimPos, nQ)}
            fill="none"
            stroke={sliceCeilingStroke(hue, !!locked[k])}
            strokeWidth={1}
            strokeLinecap="round"
            className="capacity-allocator__rim"
          />,
        )
      }
    }
    if (fillPos > 0.5 && !atZero) {
      nodes.push(
        <path
          key={`fill-${k}`}
          d={annulus(k, 0, fillPos, nQ)}
          fill={sliceValueFill(hue, !!locked[k])}
        />,
      )
    }
    const dLoView = toView(k, dLo, scaleMode, total, hard)
    if (!locked[k] && dLoView > 1 && dLoView < vPos - 1) {
      nodes.push(
        <path
          key={`dash-${k}`}
          d={arcAt(k, dLoView, nQ)}
          fill="none"
          className="capacity-allocator__dash-floor"
        />,
      )
    }
    const isActive = (hoverIdx === k || dragIdx === k) && !locked[k]
    const isDragging = dragIdx === k && !locked[k]
    nodes.push(
      <path
        key={`edge-${k}`}
        d={arcAt(k, edgePos, nQ)}
        fill="none"
        className={`capacity-allocator__edge${isActive ? ' is-active' : ''}`}
        stroke={locked[k] || atZero ? 'var(--text-disabled)' : undefined}
        strokeWidth={isActive ? 4 : 3}
        strokeLinecap="round"
        style={
          {
            '--queue-hue': hue,
            cursor: sliceCursor(!!locked[k], isDragging),
          } as CSSProperties
        }
      />,
    )
    if (atZero || fillPos > 36) {
      const tp = axisPt(k, Math.max(fillPos * 0.55, MIN_ZERO_SLICE_VIEW * 0.6), nQ)
      nodes.push(
        <text
          key={`num-${k}`}
          x={tp[0]}
          y={tp[1] + 4}
          textAnchor="middle"
          className="capacity-allocator__slice-num"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(value[k])}
        </text>,
      )
    }
  }
  for (let k = 0; k < nQ; k++) {
    const [x1, y1, x2, y2] = dividerEnds(k, nQ)
    nodes.push(
      <line key={`div-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} className="capacity-allocator__divider" />,
    )
  }
  return nodes
}

function renderSpokes(args: DrawArgs): ReactNode {
  const { nQ, value, locked, hard, scaleMode, total, hoverIdx, dragIdx, hues } = args
  const nodes: ReactNode[] = []
  ;[25, 50, 75, 100].forEach((v) => {
    nodes.push(
      <circle
        key={`g-${v}`}
        cx={CENTER}
        cy={CENTER}
        r={(v / 100) * RADIUS}
        fill="none"
        className="capacity-allocator__grid"
      />,
    )
  })
  for (let k = 0; k < nQ; k++) {
    nodes.push(renderQueueSpokes(k, nQ, hues, locked))
  }
  const vpts = value.map((v, k) => axisPt(k, toView(k, v, scaleMode, total, hard), nQ))
  nodes.push(<path key="poly" d={smoothClosed(vpts)} className="capacity-allocator__poly" />)
  for (let k = 0; k < nQ; k++) {
    const p = vpts[k]
    const isActive = (hoverIdx === k || dragIdx === k) && !locked[k]
    const isDragging = dragIdx === k && !locked[k]
    const r = isActive ? 9 : 7
    nodes.push(
      <circle
        key={`vtx-${k}`}
        cx={p[0]}
        cy={p[1]}
        r={r}
        fill={locked[k] ? 'var(--text-disabled)' : hues[k]}
        strokeWidth={isActive ? 3 : 2.5}
        className={`capacity-allocator__vtx${isActive ? ' is-active' : ''}`}
        style={
          {
            '--queue-hue': hues[k],
            cursor: sliceCursor(!!locked[k], isDragging),
          } as CSSProperties
        }
      />,
    )
  }
  return nodes
}

function buildLabels({
  queues,
  value,
  locked,
  hard,
  nQ,
  interacting,
  dragBaseline,
  onToggleLock,
}: {
  queues: AllocatorQueue[]
  value: number[]
  locked: boolean[]
  hard: Hard
  nQ: number
  interacting: boolean
  dragBaseline: number[]
  onToggleLock: (i: number) => void
}): ReactNode {
  const nodes: ReactNode[] = []

  for (let k = 0; k < nQ; k++) {
    const [ux, uy] = axisUnit(k, nQ)
    const anchor = labelTextAnchor(ux)
    const label = queues[k].name

    const [hLo, hHi] = hard[k]
    const delta =
      interacting && !locked[k] ? value[k] - (dragBaseline[k] ?? value[k]) : null
    const nameColor = locked[k] ? 'var(--text-body)' : queues[k].hue
    const anchorClass =
      anchor === 'start'
        ? 'is-anchor-start'
        : anchor === 'end'
          ? 'is-anchor-end'
          : 'is-anchor-middle'

    nodes.push(
      <div
        key={`label-${k}`}
        className={`capacity-allocator__label-block ${anchorClass}`}
        data-queue-label={k}
        style={
          {
            '--ux': ux,
            '--uy': uy,
          } as CSSProperties
        }
      >
        <div className="capacity-allocator__label-head">
          <span className="capacity-allocator__label-name" style={{ color: nameColor }}>
            {label}
          </span>
          <button
            type="button"
            className={`capacity-allocator__label-lock${locked[k] ? ' is-locked' : ''}`}
            aria-label={STRINGS.lock(queues[k].name)}
            aria-pressed={locked[k]}
            onClick={() => onToggleLock(k)}
          >
            <AppIcon name="lock" size={12} />
          </button>
        </div>
        <div className="capacity-allocator__label-val">
          {Math.round(value[k])} {STRINGS.agentsShort}
          {delta !== null && (
            <span
              className={
                delta > 0
                  ? 'capacity-allocator__delta--up'
                  : delta < 0
                    ? 'capacity-allocator__delta--down'
                    : 'capacity-allocator__delta--zero'
              }
            >
              {` (${delta > 0 ? '+' : ''}${delta})`}
            </span>
          )}
        </div>
        <div className="capacity-allocator__label-range">
          {`range ${hLo}\u2013${hHi}`}
        </div>
      </div>,
    )
  }

  return nodes
}

function SliderRows({
  queues,
  value,
  locked,
  hard,
  dyn,
  total,
  interacting,
  dragBaseline,
  onToggleLock,
  onArm,
  onDragMotion,
  onActivate,
  onPreview,
  onEnd,
  preview,
  previewIndex,
  dragIdx,
}: {
  queues: AllocatorQueue[]
  value: number[]
  locked: boolean[]
  hard: Hard
  dyn: Dyn
  total: number
  interacting: boolean
  dragBaseline: number[]
  onToggleLock: (i: number) => void
  onArm: (i: number, clientX: number, clientY: number) => void
  onDragMotion: (clientX: number, clientY: number) => boolean
  onActivate: () => void
  onPreview: (i: number, raw: number, trackWidthPx: number) => void
  onEnd: () => void
  preview: number | null
  previewIndex: number
  dragIdx: number
}) {
  return (
    <div className="capacity-allocator__rows">
      {queues.map((q, i) => {
        const shown =
          previewIndex === i && preview !== null ? preview : value[i]
        const shownInt = Math.round(shown)
        const isDragging = previewIndex === i && preview !== null
        const delta =
          interacting && !locked[i] ? shownInt - (dragBaseline[i] ?? value[i]) : null
        const style = {
          '--th': q.hue,
          '--track': trackGradient(i, hard, dyn, locked, total, q.hue),
          cursor: locked[i] ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        } as CSSProperties
        return (
          <div key={q.id} className="capacity-allocator__row">
            <span className="capacity-allocator__row-name" style={{ color: q.hue }}>
              <SfIcon name="queue" size={22} recordId={q.id} />
              {q.name}
              <button
                type="button"
                className={`capacity-allocator__lock-btn${locked[i] ? ' is-locked' : ''}`}
                aria-label={STRINGS.lock(q.name)}
                aria-pressed={locked[i]}
                onClick={() => onToggleLock(i)}
              >
                <AppIcon name="lock" size={12} />
              </button>
            </span>
            <input
              type="range"
              className="capacity-allocator__slide"
              min={0}
              max={total}
              // 'any': a native step=1 gets sanitized (rounded) by the browser on every
              // programmatic value set, not just user interaction — that would snap the
              // thumb to whole agents each frame instead of gliding through the ease.
              // Rounding for commit/display already happens in JS (moveTo, Math.round).
              step="any"
              value={shown}
              disabled={locked[i]}
              style={style}
              onPointerDown={(e) => {
                if (locked[i]) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                onArm(i, e.clientX, e.clientY)
              }}
              onPointerMove={(e) => {
                if (locked[i]) return
                if (!onDragMotion(e.clientX, e.clientY)) return
                if (dragIdx < 0) onActivate()
                const rect = e.currentTarget.getBoundingClientRect()
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                onPreview(i, pct * total, rect.width)
              }}
              onPointerUp={onEnd}
              onPointerCancel={onEnd}
            />
            <span className="capacity-allocator__row-out">
              {shownInt} {STRINGS.agentsShort}
              {delta !== null && (
                <span
                  className={
                    delta > 0
                      ? 'capacity-allocator__delta--up'
                      : delta < 0
                        ? 'capacity-allocator__delta--down'
                        : 'capacity-allocator__delta--zero'
                  }
                >
                  {` (${delta > 0 ? '+' : ''}${delta})`}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function trackGradient(
  i: number,
  hard: Hard,
  dyn: Dyn,
  locked: boolean[],
  total: number,
  hue: string,
): string {
  const [hLo, hHi] = hard[i]
  const [dLo, dHi] = dyn[i]
  const pc = (v: number) => ((v / Math.max(1, total)) * 100).toFixed(2)
  const g = 'color-mix(in srgb, var(--text-strong) 14%, transparent)'
  // Blocked (hard, outside dyn): muted queue tint. Available (dyn): stronger queue tint.
  const a = `color-mix(in srgb, ${hue} 28%, transparent)`
  const t = `color-mix(in srgb, ${hue} 55%, transparent)`
  if (locked[i]) {
    return `linear-gradient(to right, ${g} 0%, ${g} ${pc(hLo)}%, ${a} ${pc(hLo)}%, ${a} ${pc(hHi)}%, ${g} ${pc(hHi)}%, ${g} 100%)`
  }
  return `linear-gradient(to right, ${g} 0%, ${g} ${pc(hLo)}%, ${a} ${pc(hLo)}%, ${a} ${pc(dLo)}%, ${t} ${pc(dLo)}%, ${t} ${pc(dHi)}%, ${a} ${pc(dHi)}%, ${a} ${pc(hHi)}%, ${g} ${pc(hHi)}%, ${g} 100%)`
}
