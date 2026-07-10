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
  /** Larger, sentence-case pill with a leading dot — for prominent presence badges. */
  soft?: boolean
  style?: CSSProperties
}

/**
 * StatusPill — micro pill with a leading dot.
 * Pass a presence key (online/busy/away/offline) or a custom color+label.
 * `soft` renders a larger badge; otherwise it's a smaller micro pill.
 */
export function StatusPill({
  status = 'online',
  color,
  label,
  compact = false,
  soft = false,
  style = {},
}: StatusPillProps) {
  const p = PRESENCE[status] ?? PRESENCE.online
  const c = color ?? p.color
  const text = label ?? p.label

  if (soft) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'center',
          width: 'fit-content',
          maxWidth: 160,
          gap: 5,
          flexShrink: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: 'var(--r-pill)',
          color: c,
          background: `color-mix(in srgb, ${c} 12%, transparent)`,
          lineHeight: 1.2,
          ...style,
        }}
      >
        <i style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: c }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </span>
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: compact ? 120 : 140,
        gap: compact ? 4 : 5,
        fontFamily: 'var(--font-body)',
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        padding: compact ? '3px 8px' : '5px 10px',
        borderRadius: 'var(--r-pill)',
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        lineHeight: 1.2,
        ...style,
      }}
    >
      <i
        style={{
          flexShrink: 0,
          width: compact ? 5 : 6,
          height: compact ? 5 : 6,
          borderRadius: '50%',
          background: c,
        }}
      />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </span>
  )
}
