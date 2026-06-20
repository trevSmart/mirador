import type { PresenceStatus } from '../api/types'
import { presenceLabel } from '../utils/format'

interface StatusBadgeProps {
  status: PresenceStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {presenceLabel(status)}
    </span>
  )
}
