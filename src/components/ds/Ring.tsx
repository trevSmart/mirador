import { useEffect, useState, type CSSProperties } from 'react'

interface RingProps {
  used?: number
  max?: number
  color?: string
  size?: number
  photo?: string | null
  initials?: string
  faceBg?: string
  faceFg?: string
  breathe?: boolean
  style?: CSSProperties
}

/**
 * Ring — circular capacity gauge with an avatar/initials face in the centre.
 * The arc fills used/max in the status color; `breathe` adds a soft pulse
 * (used while an agent is busy).
 */
export function Ring({
  used = 0,
  max = 5,
  color = 'var(--accent)',
  size = 48,
  photo,
  initials = '',
  faceBg = 'var(--mi-av-bg)',
  faceFg = 'var(--mi-av-fg)',
  breathe = false,
  style = {},
}: RingProps) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const f = max ? used / max : 0

  // Animate the arc on data change: hold the previous fill for one painted
  // frame so the browser always interpolates old → new (a plain re-render can
  // collapse both values into a single paint, skipping the transition). A
  // double rAF is required — a single rAF runs before paint, so the old value
  // is never committed and the change still collapses. Starts from 0 on mount.
  const [shownF, setShownF] = useState(0)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShownF(f))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [f])

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-well)" strokeWidth="3.5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shownF)}
          style={{ transition: 'stroke-dashoffset var(--dur-bar) var(--ease)' }}
        />
      </svg>
      <div
        className="ring__face"
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: size * 0.27,
          color: faceFg,
          overflow: 'hidden',
          background: faceBg,
          animation: breathe ? 'pa-breathe 3.4s var(--ease) infinite' : 'none',
          ['--st' as string]: color,
        }}
      >
        <span>{initials}</span>
        {photo && (
          <img
            src={photo}
            alt=""
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.remove()
            }}
          />
        )}
      </div>
    </div>
  )
}
