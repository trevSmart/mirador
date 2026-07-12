import type { PresenceStatus } from '../api/types'

type DetailRecentKind = 'agent' | 'queue' | 'skill'

export interface DetailRecentEntry {
  kind: DetailRecentKind
  id: string
  title: string
  meta: string
  status?: PresenceStatus
  flag?: boolean
  color?: string
  backlog?: number
  online?: number
  agents?: number
  viewedAt: number
}

const STORAGE_KEY = 'mirador.detailRecents.v1'
const MAX_RECENTS = 10
const VALID_KINDS = new Set<DetailRecentKind>(['agent', 'queue', 'skill'])

type DetailRecentResolver = (config: {
  kind: string
  id: string
  name?: string
}) => Omit<DetailRecentEntry, 'viewedAt'> | null

let resolver: DetailRecentResolver | null = null

export function setDetailRecentResolver(fn: DetailRecentResolver | null): void {
  resolver = fn
}

// Version + listeners let the UI (GlobalSearch's keyboard list) stay in sync
// with writes made from anywhere (drawer, rows), not just its own selections.
let version = 0
const listeners = new Set<() => void>()

export function getDetailRecentsVersion(): number {
  return version
}

export function subscribeDetailRecents(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyDetailRecentsChanged(): void {
  version += 1
  for (const listener of [...listeners]) listener()
}

function sanitizeEntry(raw: unknown): DetailRecentEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Partial<DetailRecentEntry>
  const kind = entry.kind
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  const title = typeof entry.title === 'string' ? entry.title.trim() : ''
  if (!kind || !VALID_KINDS.has(kind) || !id || !title) return null
  const meta = typeof entry.meta === 'string' ? entry.meta : ''
  const viewedAt = Number(entry.viewedAt)
  return {
    kind,
    id,
    title,
    meta,
    status:
      entry.status === 'online' ||
      entry.status === 'busy' ||
      entry.status === 'away' ||
      entry.status === 'offline'
        ? entry.status
        : undefined,
    flag: entry.flag === true,
    color: typeof entry.color === 'string' ? entry.color : undefined,
    backlog: Number.isFinite(Number(entry.backlog)) ? Number(entry.backlog) : undefined,
    online: Number.isFinite(Number(entry.online)) ? Number(entry.online) : undefined,
    agents: Number.isFinite(Number(entry.agents)) ? Number(entry.agents) : undefined,
    viewedAt: Number.isFinite(viewedAt) ? viewedAt : Date.now(),
  }
}

function loadEntries(): DetailRecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeEntry).filter((entry): entry is DetailRecentEntry => entry != null)
  } catch {
    return []
  }
}

function saveEntries(entries: DetailRecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENTS)))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getDetailRecents(): DetailRecentEntry[] {
  return loadEntries()
}

export function recordDetailOpen(config: {
  kind: string
  id: string
  name?: string
}): void {
  if (!config?.kind || !config?.id || !VALID_KINDS.has(config.kind as DetailRecentKind)) return
  const snapshot = resolver?.(config)
  if (!snapshot) return

  const key = `${snapshot.kind}:${snapshot.id}`
  const next = loadEntries().filter((entry) => `${entry.kind}:${entry.id}` !== key)
  next.unshift({ ...snapshot, viewedAt: Date.now() })
  saveEntries(next)
  notifyDetailRecentsChanged()
}
