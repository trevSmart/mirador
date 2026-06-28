import type { CSSProperties, ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'ok' | 'watch' | 'alert'

interface ToneDef {
  bg: string
  fg: string
}

const TONES: Record<BadgeTone, ToneDef> = {
  neutral: { bg: 'var(--surface-well)', fg: 'var(--text-body)' },
  accent: { bg: 'var(--accent-tint)', fg: 'var(--accent)' },
  ok: { bg: 'var(--mi-ok-soft)', fg: 'var(--status-ok)' },
  watch: { bg: 'var(--mi-watch-soft)', fg: 'var(--status-watch)' },
  alert: { bg: 'var(--status-alert)', fg: '#fff' },
}

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  pulse?: boolean
  style?: CSSProperties
}

/**
 * Badge — compact label or count. `tone="alert"` + `pulse` gives the
 * red "⚑ AJUDA" flag badge that throbs for attention.
 */
export function Badge({ children, tone = 'neutral', pulse = false, style = {} }: BadgeProps) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.03em',
        padding: '3px 8px',
        borderRadius: 'var(--r-pill)',
        background: t.bg,
        color: t.fg,
        animation: pulse ? 'pa-throb 1.6s infinite' : 'none',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
