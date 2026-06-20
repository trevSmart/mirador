import type { PresenceStatus } from '../api/types'
import { presenceLabel } from '../utils/format'
import { StatusPill } from './ds'

interface StatusBadgeProps {
  status: PresenceStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <StatusPill status={status} label={presenceLabel(status)} />
}
