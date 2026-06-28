import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode
  active?: boolean
  dotColor?: string
  count?: number
  style?: CSSProperties
}

/**
 * Filter chip — rounded, optional status dot, toggle on/off.
 * Used in agent toolbars to filter by presence status.
 */
export function Chip({ children, active = false, dotColor, count, style = {}, ...rest }: ChipProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 11px',
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    transition: 'all var(--dur-fast) var(--ease)',
    background: active ? 'var(--accent-tint)' : 'var(--surface-card)',
    border: `1px solid ${active ? 'var(--mi-accent-line)' : 'var(--border-subtle)'}`,
    color: active ? 'var(--accent)' : 'var(--text-body)',
    ...style,
  }
  return (
    <button
      style={base}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.color = 'var(--text-strong)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-body)'
        }
      }}
      {...rest}
    >
      {dotColor && <i style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}
      {children}
      {count != null && (
        <b
          style={{
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'calc(1em + var(--mono-fs-nudge))',
            color: active ? 'var(--accent)' : 'var(--text-strong)',
            fontWeight: 500,
          }}
        >
          {count}
        </b>
      )}
    </button>
  )
}
