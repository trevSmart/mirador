import type { WorkItem } from '../api/types'

const TERMINAL_SESSION_STATUSES = new Set(['Ended', 'Inactive', 'Error'])

export function isMessagingSession(
  item: Pick<WorkItem, 'objectApiName' | 'workItemId'>,
): boolean {
  if (item.objectApiName === 'MessagingSession') return true
  return !!item.workItemId?.startsWith('0Mw')
}

export function isLiveMessagingSession(
  sessionStatus: string | null | undefined,
  recordStatus?: string | null,
): boolean {
  const status = sessionStatus ?? recordStatus
  if (!status) return true
  return !TERMINAL_SESSION_STATUSES.has(status)
}

export function messagingTimestampMs(value: number | null | undefined): Date | null {
  if (value == null || !Number.isFinite(value)) return null
  return new Date(value)
}

export function formatMessagingTime(value: number | null | undefined): string | null {
  const date = messagingTimestampMs(value)
  if (!date) return null
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function senderLabel(
  entry: { senderRole: string; senderSubject: string | null },
  options: {
    endUserName?: string | null
    agentNameById?: Map<string, string>
  },
): string {
  if (entry.senderRole === 'EndUser') {
    return options.endUserName?.trim() || 'Client'
  }
  if (entry.senderRole === 'Agent' && entry.senderSubject) {
    const agentName = options.agentNameById?.get(entry.senderSubject)
    if (agentName) return agentName
    if (entry.senderSubject.startsWith('005')) return 'Agent'
  }
  if (entry.senderRole === 'Chatbot') return 'Bot'
  return entry.senderRole || 'Participant'
}
