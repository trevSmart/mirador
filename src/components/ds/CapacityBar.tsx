import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FadeValue } from './FadeValue'

interface CapacityBarProps {
  used?: number
  max?: number
  color?: string
  label?: string
  showHead?: boolean
  style?: CSSProperties
}

// easeInOutBack — accelerates in over the opening stretch and eases out over
// the closing one (each ramp spans a good chunk of the bar, not a single
// segment), with a small settle bounce at the very end. The overshoot lives
// inside the frontier segment / a fixed sliver, never phantom capacity.
function easeInOutBack(t: number): number {
  const c1 = 1.70158
  const c2 = c1 * 1.525
  return t < 0.5
    ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
    : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
}

/**
 * CapacityBar — discrete used/max meter. One segment per slot; filled
 * segments take the status color, empties stay on the inset track. The fill
 * is driven by a single rAF-animated frontier that sweeps across the WHOLE
 * bar, so segments visibly fill one after another (start → end) and the
 * easing curve spans the full width regardless of how many segments there
 * are — not a stop-start per segment.
 */
export function CapacityBar({
  used = 0,
  max = 5,
  color = 'var(--accent)',
  label = 'Capacitat',
  showHead = true,
  style = {},
}: CapacityBarProps) {
  const targetUsed = Math.max(0, Math.min(max, used))

  // displayUsed is a continuous 0..max value: segment i's fill is
  // clamp(displayUsed - i, 0, 1). A single animation drives it edge-to-edge.
  const [displayUsed, setDisplayUsed] = useState(0)
  const posRef = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = posRef.current
    const to = targetUsed
    const dist = Math.abs(to - from)
    if (reduce || dist === 0) {
      posRef.current = to
      setDisplayUsed(to)
      return
    }
    // Duration grows sub-linearly with the distance travelled, so a long bar
    // still feels swift rather than dragging one segment-time per slot.
    const duration = 300 + 150 * Math.sqrt(dist)
    let raf = 0
    let start = 0
    const frame = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / duration)
      // Bound the overshoot to a fixed sliver so the bounce is the same tiny
      // kiss whether the bar has 3 slots or 12 — never proportional to distance.
      const pos = Math.min(from + (to - from) * easeInOutBack(t), to + 0.14)
      posRef.current = pos
      setDisplayUsed(pos)
      if (t < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        posRef.current = to
        setDisplayUsed(to)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [targetUsed])

  return (
    <div style={style}>
      {showHead && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: 11,
            color: 'var(--text-body)',
            marginBottom: 5,
          }}
        >
          <span>{label}</span>
          <b
            style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-strong)',
              fontSize: 'calc(12px + var(--mono-fs-nudge))',
              fontWeight: 500,
            }}
          >
            <FadeValue as="span" value={used} /> / <FadeValue as="span" value={max} />
          </b>
        </div>
      )}
      <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-well)', overflow: 'hidden', display: 'flex', gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => {
          const fill = Math.min(1, Math.max(0, displayUsed - i))
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: '100%',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${fill * 100}%`,
                  borderRadius: 2,
                  background: color,
                  // width is animated by the rAF frontier, not by CSS —
                  // a CSS width transition here would fight the sweep.
                  transition: 'background-color var(--dur-bar) var(--ease)',
                }}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}
