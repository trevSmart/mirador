/* Tint de registre — el pont entre la preferència `tintRecordIcons` i les icones.
   Retorna el color derivat de l'ID quan el tenyit està actiu, i undefined quan no:
   llavors <SfIcon> es queda amb el color oficial SLDS de l'objecte.

   Llegim el context directament (no via usePreferences) per poder caure als
   defaults quan no hi ha PreferencesProvider: SfIcon es renderitza en tests i
   contextos aïllats i no ha de petar per una preferència. */

import { useCallback, useContext } from 'react'
import { PreferencesContext } from '../settings/preferences-context'
import { PREFERENCES_DEFAULTS } from '../settings/preferences'
import { colorFromRecordId } from '../utils/color-from-string'

export function useRecordTint(): (id: string | null | undefined) => string | undefined {
  const ctx = useContext(PreferencesContext)
  const enabled = ctx?.prefs.tintRecordIcons ?? PREFERENCES_DEFAULTS.tintRecordIcons

  return useCallback(
    (id: string | null | undefined) => (enabled && id ? colorFromRecordId(id) : undefined),
    [enabled],
  )
}
