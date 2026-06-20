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
  style?: CSSProperties
}

/**
 * StatusPill — uppercase micro pill with a leading dot.
 * Pass a presence key (online/busy/away/offline) or a custom color+label.
 */
export function StatusPill({ status = 'online', color, label, style = {} }: StatusPillProps) {
  const p = PRESENCE[status] ?? PRESENCE.online
  const c = color ?? p.color
  const text = label ?? p.label
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.03em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 'var(--r-pill)',
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        ...style,
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      {text}
    </span>
  )
}
