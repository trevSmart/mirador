import type { CSSProperties } from 'react'
import type { PresenceStatus } from '../../api/types'

interface PresenceDef {
  color: string
  label: string
}

const PRESENCE: Record<PresenceStatus, PresenceDef> = {
  online: { color: 'var(--status-ok)', label: 'Online' },
  busy: { color: 'var(--status-alert)', label: 'Ocupat' },
  away: { color: 'var(--status-watch)', label: 'Absent' },
  offline: { color: 'var(--text-disabled)', label: 'Desconnectat' },
}

interface StatusPillProps {
  status?: PresenceStatus
  color?: string
  label?: string
  compact?: boolean
  style?: CSSProperties
}

/**
 * StatusPill — uppercase micro pill with a leading dot.
 * Pass a presence key (online/busy/away/offline) or a custom color+label.
 */
export function StatusPill({
  status = 'online',
  color,
  label,
  compact = false,
  style = {},
}: StatusPillProps) {
  const p = PRESENCE[status] ?? PRESENCE.online
  const c = color ?? p.color
  const text = label ?? p.label
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 5,
        fontFamily: 'var(--font-body)',
        fontSize: compact ? 9 : 10.5,
        fontWeight: 600,
        letterSpacing: '.03em',
        textTransform: 'uppercase',
        padding: compact ? '1px 5px' : '3px 8px',
        borderRadius: 'var(--r-pill)',
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        lineHeight: 1.2,
        ...style,
      }}
    >
      <i
        style={{
          width: compact ? 5 : 6,
          height: compact ? 5 : 6,
          borderRadius: '50%',
          background: c,
        }}
      />
      {text}
    </span>
  )
}
