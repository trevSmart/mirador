import type { PresenceStatus } from '../api/types'
import { presenceLabel } from '../utils/format'
import { StatusPill } from './ds'

interface StatusBadgeProps {
  status: PresenceStatus
  /** Override the displayed text — e.g. the org's real presence status label.
   *  Falls back to the normalized category label when omitted. */
  label?: string | null
  compact?: boolean
  soft?: boolean
}

export function StatusBadge({ status, label, compact = false, soft = false }: StatusBadgeProps) {
  return (
    <StatusPill
      status={status}
      label={label ?? presenceLabel(status)}
      compact={compact}
      soft={soft}
    />
  )
}
