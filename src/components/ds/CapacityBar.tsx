import type { CSSProperties } from 'react'

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
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {used} / {max}
          </b>
        </div>
      )}
      <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-well)', overflow: 'hidden', display: 'flex', gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: '100%',
              borderRadius: 2,
              background: i < used ? color : 'transparent',
              transition: 'background-color var(--dur-base) var(--ease)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
