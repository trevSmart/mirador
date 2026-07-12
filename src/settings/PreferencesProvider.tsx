/* Preferences — app-wide live value.
   Reads the persisted preferences once, then keeps in sync with savePreferences()
   (same tab, via a custom event) and with other tabs (via the storage event),
   mirroring how useDeveloperMode works. Consumers read `prefs` via usePreferences;
   the settings modal writes through `save`. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { PreferencesContext, type PreferencesContextValue } from './preferences-context'
import { buildSpaceCanvasWash } from './space-canvas-wash'
import { applyTheme, resolveTheme, systemDarkQuery } from './theme'
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
    const sync = () => setPrefs(loadPreferences())
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
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
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
