/* Preferences — app-wide live value.
   Reads the persisted preferences once, then keeps in sync with savePreferences()
   (same tab, via a custom event) and with other tabs (via the storage event),
   mirroring how useDeveloperMode works. Consumers read `prefs` via usePreferences;
   the settings modal writes through `save`. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { PreferencesContext, type PreferencesContextValue } from './preferences-context'
import { buildSpaceCanvasWash } from './space-canvas-wash'
import { applyTheme, getAppliedTheme, resolveTheme, systemDarkQuery, withThemeTransition } from './theme'
import { useResolvedTheme } from './use-resolved-theme'
import {
  loadPreferences,
  PREFERENCES_EVENT,
  PREFERENCES_KEY,
  savePreferences,
  type Preferences,
} from './preferences'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)

  useEffect(() => {
    const sync = () => {
      const next = loadPreferences()
      const nextTheme = resolveTheme(next.theme, systemDarkQuery()?.matches ?? false)
      if (nextTheme === getAppliedTheme()) {
        setPrefs(next)
        return
      }
      // Theme flip: apply the attribute and the context update in the same
      // handler so React batches THEME_EVENT subscribers and context consumers
      // into ONE render (an effect-driven applyTheme would cost a second full
      // pass), and wrap it in a crossfade that hides the global style recalc.
      withThemeTransition(() => {
        applyTheme(nextTheme)
        setPrefs(next)
      })
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_KEY) sync()
    }
    window.addEventListener(PREFERENCES_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(PREFERENCES_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const mq = systemDarkQuery()
    const apply = () => applyTheme(resolveTheme(prefs.theme, mq?.matches ?? false))
    apply()
    if (prefs.theme === 'system' && mq) {
      const onSystemChange = () => withThemeTransition(apply)
      mq.addEventListener('change', onSystemChange)
      return () => mq.removeEventListener('change', onSystemChange)
    }
  }, [prefs.theme])

  const resolvedTheme = useResolvedTheme()

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--fv-canvas-wash',
      buildSpaceCanvasWash(prefs.spaceCanvasTint, resolvedTheme),
    )
  }, [prefs.spaceCanvasTint, resolvedTheme])

  const save = useCallback((next: Preferences) => {
    devLog.action('settings:save', next)
    savePreferences(next) // fires PREFERENCES_EVENT → sync() updates state
  }, [])

  const value = useMemo<PreferencesContextValue>(() => ({ prefs, save }), [prefs, save])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
