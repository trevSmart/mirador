import { useEffect, useState, type CSSProperties } from 'react'

interface PressureBarProps {
  value?: number
  height?: number
  style?: CSSProperties
}

/** Smooth turquoise → watch → alert blend; 0 = free, 1 = max load. */
function pressureColor(p: number): string {
  if (p <= 0.5) {
    const t = p / 0.5
    return `color-mix(in srgb, var(--pa-accent-2) ${(1 - t) * 100}%, var(--status-watch))`
  }
  const t = (p - 0.5) / 0.5
  return `color-mix(in srgb, var(--status-watch) ${(1 - t) * 100}%, var(--status-alert))`
}

/**
 * PressureBar — continuous fill meter that colors itself by load:
 * turquoise at low pressure, smoothly blending through amber to red at max. Used on queue cards.
 */
export function PressureBar({ value = 0, height = 6, style = {} }: PressureBarProps) {
  const p = Math.max(0, Math.min(1, value))
  const color = pressureColor(p)

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
          transition: 'width var(--dur-bar) var(--ease), background-color var(--dur-bar) var(--ease)',
        }}
      />
    </div>
  )
}
