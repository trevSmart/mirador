/* Theme — pure resolution logic plus the single DOM application point.
   The stored preference is light/dark/system (see preferences.ts); what the UI
   actually renders is the RESOLVED theme (light|dark), applied as
   `data-theme` on <html> so the [data-theme='dark'] token block in index.css
   takes over. index.html applies the same attribute pre-mount to avoid a
   light flash; this module owns it from mount onward. No React here —
   use-resolved-theme.ts exposes the applied value as a hook. */

import type { ThemePreference } from './preferences'

export type ResolvedTheme = 'light' | 'dark'

export const THEME_EVENT = 'mirador:theme'

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

/** The OS-level appearance query, or null where matchMedia is unavailable (jsdom). */
export function systemDarkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
}

/** Stamp the resolved theme on <html> and notify in-app listeners. */
export function applyTheme(theme: ResolvedTheme): void {
  if (document.documentElement.dataset.theme === theme) return
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function getAppliedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function subscribeAppliedTheme(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback)
  return () => window.removeEventListener(THEME_EVENT, callback)
}
