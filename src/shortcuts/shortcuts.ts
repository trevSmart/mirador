/* Taula declarativa de dreceres de teclat globals.
   AFEGIR UNA DRECERA NOVA = afegir una entrada aquí. El listener únic viu a
   GlobalShortcutsProvider.tsx i no s'ha de tocar per afegir dreceres. */

import type { Shortcut } from './shortcut-types'

export const SHORTCUTS: Shortcut[] = [
  {
    id: 'open-settings',
    key: 's',
    run: (ctx) => ctx.openSettings(),
  },
]
