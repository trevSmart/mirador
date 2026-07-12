/* User preferences — pure model.
   A single flat object persisted in localStorage. No React here: just the shape,
   the defaults, and load/save with sanitization so a corrupt or partial stored
   value can never break a consumer. The <SettingsModal> edits a draft copy and
   calls savePreferences(); usePreferences exposes the live value to the app. */

import { SPACE_CANVAS_TINTS, type SpaceCanvasTint } from './space-canvas-wash'

export type SpaceViewMode = '2d' | '3d'
export type Lang = 'ca' | 'es' | 'en'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Preferences {
  /** Override data source to mock mode regardless of server config. */
  mockOverride: boolean
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
  /**
   * Include offline service reps in the agent roster (snapshot `scope=all`).
   * When off, only agents currently connected to Omni-Channel are shown
   * (`scope=connected`). Mirrors Command Center for Service's configurable
   * "show all offline service reps" behavior.
   */
  showOfflineAgents: boolean

  /**
   * Colour theme: explicit light/dark, or follow the OS appearance.
   * Resolved and applied as `data-theme` on <html> — see settings/theme.ts.
   */
  theme: ThemePreference

  /**
   * Tint a record's Salesforce object icon with the colour derived from its id.
   * When off, the icon keeps the official SLDS object colour and only the record
   * name stays tinted.
   */
  tintRecordIcons: boolean

  /** Space panel view to open with. */
  defaultSpaceView: SpaceViewMode
  /** Show agent avatars on the space. */
  showAvatars: boolean
  /** Animate towers / beacons in the 3D space view. */
  animations: boolean
  /** Background wash tint behind space room renders. */
  spaceCanvasTint: SpaceCanvasTint
  lang: Lang

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
  mockOverride: false,
  refreshInterval: 30,
  autoRefresh: true,
  maxWaitSeconds: 180,
  slaTarget: 80,
  alertPct: 30,
  showOfflineAgents: true,

  theme: 'system',
  tintRecordIcons: true,
  defaultSpaceView: '3d',
  showAvatars: true,
  animations: true,
  spaceCanvasTint: 'none',
  lang: 'ca',

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
function sanitizePreferences(raw: Partial<Preferences> | null | undefined): Preferences {
  const d = PREFERENCES_DEFAULTS
  const p = raw ?? {}
  const refresh = clampInt(p.refreshInterval, d.refreshInterval, 1, 3600)
  return {
    mockOverride: asBool(p.mockOverride, d.mockOverride),
    refreshInterval: (REFRESH_OPTIONS as readonly number[]).includes(refresh) ? refresh : d.refreshInterval,
    autoRefresh: asBool(p.autoRefresh, d.autoRefresh),
    maxWaitSeconds: clampInt(p.maxWaitSeconds, d.maxWaitSeconds, 30, 3600),
    slaTarget: clampInt(p.slaTarget, d.slaTarget, 50, 100),
    alertPct: clampInt(p.alertPct, d.alertPct, 5, 100),
    showOfflineAgents: asBool(p.showOfflineAgents, d.showOfflineAgents),

    theme: oneOf(p.theme, ['light', 'dark', 'system'], d.theme),
    tintRecordIcons: asBool(p.tintRecordIcons, d.tintRecordIcons),
    defaultSpaceView: oneOf(p.defaultSpaceView, ['2d', '3d'], d.defaultSpaceView),
    showAvatars: asBool(p.showAvatars, d.showAvatars),
    animations: asBool(p.animations, d.animations),
    spaceCanvasTint: oneOf(p.spaceCanvasTint, SPACE_CANVAS_TINTS, d.spaceCanvasTint),
    lang: oneOf(p.lang, ['ca', 'es', 'en'], d.lang),

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
