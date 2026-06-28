/* Preferences — app-wide live value.
   Reads the persisted preferences once, then keeps in sync with savePreferences()
   (same tab, via a custom event) and with other tabs (via the storage event),
   mirroring how useDeveloperMode works. Consumers read `prefs` via usePreferences;
   the settings modal writes through `save`. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { PreferencesContext, type PreferencesContextValue } from './preferences-context'
import { buildSpaceCanvasWash } from './space-canvas-wash'
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
    document.documentElement.style.setProperty(
      '--fv-canvas-wash',
      buildSpaceCanvasWash(prefs.spaceCanvasTint),
    )
  }, [prefs.spaceCanvasTint])

  const save = useCallback((next: Preferences) => {
    devLog.action('settings:save', next)
    savePreferences(next) // fires PREFERENCES_EVENT → sync() updates state
  }, [])

  const value = useMemo<PreferencesContextValue>(() => ({ prefs, save }), [prefs, save])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
