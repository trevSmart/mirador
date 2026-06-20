import { useEffect, useState, type CSSProperties } from 'react'

interface PressureBarProps {
  value?: number
  height?: number
  style?: CSSProperties
}

/**
 * PressureBar — continuous fill meter that colors itself by load:
 * green < 50% → amber < 80% → red. Used on queue cards.
 */
export function PressureBar({ value = 0, height = 6, style = {} }: PressureBarProps) {
  const p = Math.max(0, Math.min(1, value))
  const color = p < 0.5 ? 'var(--status-ok)' : p < 0.8 ? 'var(--status-watch)' : 'var(--status-alert)'

  // Hold the previous width for one painted frame so data-change re-renders
  // always interpolate old → new (and the bar grows in from 0 on mount). Needs
  // a double rAF: a single rAF fires before paint, so the old value is never
  // committed and the width change collapses into one frame.
  const [shownP, setShownP] = useState(0)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShownP(p))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [p])

  return (
    <div style={{ height, borderRadius: height, background: 'var(--surface-well)', overflow: 'hidden', ...style }}>
      <span
        style={{
          display: 'block',
          height: '100%',
          borderRadius: height,
          width: `${Math.max(6, shownP * 100)}%`,
          background: color,
          transition: 'width var(--dur-bar) var(--ease)',
        }}
      />
    </div>
  )
}
