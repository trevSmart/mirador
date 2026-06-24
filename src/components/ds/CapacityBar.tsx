import { useEffect, useState, type CSSProperties } from 'react'
import { FadeValue } from './FadeValue'

interface CapacityBarProps {
  used?: number
  max?: number
  color?: string
  label?: string
  showHead?: boolean
  style?: CSSProperties
}

/**
 * CapacityBar — discrete used/max meter. One segment per slot; filled
 * segments take the status color, empties stay on the inset track.
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

  // displayUsed lags one painted frame behind targetUsed so width transitions
  // always run old → new (and the bar grows in from 0 on mount). See Ring.
  const [displayUsed, setDisplayUsed] = useState(0)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDisplayUsed(targetUsed))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
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
          // Width is driven only by displayUsed (lagging value). When targetUsed
          // changes, displayUsed still holds the old count for one painted frame,
          // then steps to the new count — the browser transitions only the segment
          // whose fill actually changes (the boundary slot).
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
                  transition: 'width var(--dur-bar) var(--ease), background-color var(--dur-bar) var(--ease)',
                }}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}
