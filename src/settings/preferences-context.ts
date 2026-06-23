/* Preferences — context + hook (no components, so Fast Refresh stays happy).
   The <PreferencesProvider> lives in PreferencesProvider.tsx and supplies this
   context's value. */

import { createContext, useContext } from 'react'
import type { Preferences } from './preferences'

export interface PreferencesContextValue {
  prefs: Preferences
  /** Persist a full preferences object (the live value updates everywhere). */
  save: (next: Preferences) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }
  return ctx
}
