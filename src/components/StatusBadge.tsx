import type { PresenceStatus } from '../api/types'
import { presenceLabel } from '../utils/format'
import { StatusPill } from './ds'

interface StatusBadgeProps {
  status: PresenceStatus
  compact?: boolean
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  return <StatusPill status={status} label={presenceLabel(status)} compact={compact} />
}
