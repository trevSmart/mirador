/* User preferences — pure model.
   A single flat object persisted in localStorage. No React here: just the shape,
   the defaults, and load/save with sanitization so a corrupt or partial stored
   value can never break a consumer. The <SettingsModal> edits a draft copy and
   calls savePreferences(); usePreferences exposes the live value to the app. */

export type FloorViewMode = '2d' | '3d'
export type Lang = 'ca' | 'es' | 'en'
export type TimeFormat = '24h' | '12h'

export interface Preferences {
  /** Data refresh cadence, in seconds. */
  refreshInterval: number
  /** Poll for fresh data in the background while the tab is active. */
  autoRefresh: boolean
  /** Queue alert threshold: max acceptable wait, in seconds. */
  maxWaitSeconds: number
  /** Service-level target, as a percentage (0–100). */
  slaTarget: number
  /** Share of agents in alert needed to raise a global warning (0–100). */
  alertPct: number

  /** Floor panel view to open with. */
  defaultFloorView: FloorViewMode
  /** Show agent avatars on the floor. */
  showAvatars: boolean
  /** Animate towers / beacons in the 3D floor view. */
  animations: boolean
  lang: Lang
  timeFormat: TimeFormat

  /** Allow browser push notifications when the tab is hidden. */
  browserNotifs: boolean
  /** Notify when a queue exceeds its max wait. */
  queueAlert: boolean
  /** Notify when an agent drops offline unexpectedly. */
  agentOfflineAlert: boolean
  /** Play a sound on critical alerts. */
  soundAlert: boolean
}

export const PREFERENCES_DEFAULTS: Preferences = {
  refreshInterval: 30,
  autoRefresh: true,
  maxWaitSeconds: 180,
  slaTarget: 80,
  alertPct: 30,

  defaultFloorView: '2d',
  showAvatars: true,
  animations: true,
  lang: 'ca',
  timeFormat: '24h',

  browserNotifs: false,
  queueAlert: true,
  agentOfflineAlert: true,
  soundAlert: false,
}

export const PREFERENCES_KEY = 'mirador.preferences.v1'
export const PREFERENCES_EVENT = 'mirador:preferences'

/** Selectable refresh cadences (seconds) surfaced in the UI. */
export const REFRESH_OPTIONS = [10, 30, 60, 300] as const

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** Coerce any stored / partial blob into a complete, valid Preferences object. */
export function sanitizePreferences(raw: Partial<Preferences> | null | undefined): Preferences {
  const d = PREFERENCES_DEFAULTS
  const p = raw ?? {}
  const refresh = clampInt(p.refreshInterval, d.refreshInterval, 1, 3600)
  return {
    refreshInterval: (REFRESH_OPTIONS as readonly number[]).includes(refresh) ? refresh : d.refreshInterval,
    autoRefresh: asBool(p.autoRefresh, d.autoRefresh),
    maxWaitSeconds: clampInt(p.maxWaitSeconds, d.maxWaitSeconds, 30, 3600),
    slaTarget: clampInt(p.slaTarget, d.slaTarget, 50, 100),
    alertPct: clampInt(p.alertPct, d.alertPct, 5, 100),

    defaultFloorView: oneOf(p.defaultFloorView, ['2d', '3d'], d.defaultFloorView),
    showAvatars: asBool(p.showAvatars, d.showAvatars),
    animations: asBool(p.animations, d.animations),
    lang: oneOf(p.lang, ['ca', 'es', 'en'], d.lang),
    timeFormat: oneOf(p.timeFormat, ['24h', '12h'], d.timeFormat),

    browserNotifs: asBool(p.browserNotifs, d.browserNotifs),
    queueAlert: asBool(p.queueAlert, d.queueAlert),
    agentOfflineAlert: asBool(p.agentOfflineAlert, d.agentOfflineAlert),
    soundAlert: asBool(p.soundAlert, d.soundAlert),
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    return sanitizePreferences(raw ? (JSON.parse(raw) as Partial<Preferences>) : null)
  } catch {
    return { ...PREFERENCES_DEFAULTS }
  }
}

/** Persist a full preferences object and notify in-tab listeners. */
export function savePreferences(prefs: Preferences): void {
  const clean = sanitizePreferences(prefs)
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(clean))
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
}
