import type { ChannelKey, PresenceStatus, RecordDetail, WorkStatus } from '../api/types'

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
  offline: 'Desconnectat',
}

export function presenceLabel(status: PresenceStatus): string {
  return PRESENCE_LABELS[status]
}

function formatDurationDays(totalMin: number): string {
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin % (24 * 60)) / 60)
  const minutes = totalMin % 60
  let out = `${days}d`
  if (hours > 0) {
    out += ` ${hours}h`
  }
  if (minutes > 0) {
    out += ` ${minutes}m`
  }
  return out
}

function formatDurationMinutes(totalMin: number): string {
  const minutes = Math.max(0, Math.floor(Number(totalMin) || 0))
  if (minutes < 60) {
    return `${minutes}m`
  }
  if (minutes >= 24 * 60) {
    return formatDurationDays(minutes)
  }
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

/** Wait-time KPI formatter (seconds in, human label out). */
export function formatDurationSec(totalSec: number, { short = false } = {}): string {
  const seconds = Math.max(0, Math.floor(Number(totalSec) || 0))
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (short) {
    return formatDurationMinutes(Math.round(seconds / 60))
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60

  if (hours >= 24) {
    return formatDurationDays(hours * 60 + minutes)
  }

  if (hours > 0) {
    let out = `${hours}h`
    if (minutes > 0) {
      out += ` ${minutes}m`
    }
    if (remainder > 0) {
      out += ` ${String(remainder).padStart(2, '0')}s`
    }
    return out
  }

  return `${minutes}m ${String(remainder).padStart(2, '0')}s`
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

/** ISO 8601 (from Apex) → localized date+time. Returns '—' for null/invalid. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function recordStatusLabel(
  detail: Pick<RecordDetail, 'recordStatus' | 'recordClosed'>,
): string | null {
  if (detail.recordClosed) return 'Tancat'
  return detail.recordStatus ?? null
}

export function recordStatusTone(
  detail: Pick<RecordDetail, 'recordStatus' | 'recordClosed'>,
): 'neutral' | 'ok' {
  return detail.recordClosed ? 'neutral' : 'ok'
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
