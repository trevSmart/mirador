import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger'
type ButtonSize = 'sm' | 'md'

interface VariantDef {
  background: string
  border: string
  color: string
}

const VARIANTS: Record<ButtonVariant, VariantDef> = {
  primary: { background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--accent-fg)' },
  ghost: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-body)' },
  subtle: { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)' },
  danger: { background: 'var(--status-alert)', border: '1px solid var(--status-alert)', color: '#fff' },
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  style?: CSSProperties
}

/**
 * Mirador Button — the product's action control.
 * Variants: primary (accent fill), ghost (hairline outline), subtle (surface + border), danger.
 * Sizes: sm / md. Optional leading glyph (unicode or node).
 */
export function Button({
  children,
  variant = 'subtle',
  size = 'md',
  icon = null,
  disabled = false,
  type = 'button',
  style = {},
  ...rest
}: ButtonProps) {
  const pad = size === 'sm' ? '7px 13px' : '11px 18px'
  const fs = size === 'sm' ? 13 : 13.5
  const v = VARIANTS[variant]

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    fontSize: fs,
    lineHeight: 1,
    padding: pad,
    borderRadius: 'var(--r-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition:
      'border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease)',
    whiteSpace: 'nowrap',
    ...v,
    ...style,
  }

  return (
    <button
      type={type}
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) return
        if (variant === 'subtle' || variant === 'ghost') {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.boxShadow = 'var(--shadow)'
        } else {
          e.currentTarget.style.filter = 'brightness(1.06)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = v.border.split(' ').pop() ?? ''
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.filter = 'none'
      }}
      {...rest}
    >
      {icon != null && <span style={{ fontSize: fs + 2, lineHeight: 0 }}>{icon}</span>}
      {children}
    </button>
  )
}
