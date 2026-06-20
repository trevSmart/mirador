import type { ChannelKey, PresenceStatus, WorkStatus } from '../api/types'

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  veu: 'Veu',
  chat: 'Chat',
  email: 'Email',
  wa: 'WhatsApp',
  cas: 'Cas',
}

const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  assigned: 'Assignat',
  queued: 'En cua',
}

export function channelLabel(channelKey: ChannelKey): string {
  return CHANNEL_LABELS[channelKey]
}

export function workStatusLabel(status: WorkStatus): string {
  return WORK_STATUS_LABELS[status]
}

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'En línia',
  busy: 'Ocupat',
  away: 'Absent',
  offline: 'Fora de línia',
}

export function presenceLabel(status: PresenceStatus): string {
  return PRESENCE_LABELS[status]
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes < 60) {
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`
}

export function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
