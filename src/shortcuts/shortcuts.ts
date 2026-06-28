/* Taula declarativa de dreceres de teclat globals.
   AFEGIR UNA DRECERA NOVA = afegir una entrada aquí. El listener únic viu a
   GlobalShortcutsProvider.tsx i no s'ha de tocar per afegir dreceres. */

import type { Shortcut } from './shortcut-types'

export const SHORTCUTS: Shortcut[] = [
  // Obrir panels (lletra mnemònica, tecla sola).
  { id: 'open-home',        key: 'h', run: (ctx) => ctx.openPanel('home') },
  { id: 'open-wallboard',   key: 'b', run: (ctx) => ctx.openPanel('wallboard') },
  { id: 'open-agents',      key: 'a', run: (ctx) => ctx.openPanel('agents') },
  { id: 'open-queues',      key: 'q', run: (ctx) => ctx.openPanel('queues') },
  { id: 'open-skills',      key: 's', run: (ctx) => ctx.openPanel('skills') },
  { id: 'open-work',        key: 'w', run: (ctx) => ctx.openPanel('work') },
  { id: 'open-floor',       key: 'f', run: (ctx) => ctx.openPanel('floor') },
  { id: 'open-floor-editor', key: 'e', run: (ctx) => ctx.openPanel('floorEditor') },

  // Settings (mogut de 's' a ',' perquè Skills agafa la 's').
  { id: 'open-settings',    key: ',', run: (ctx) => ctx.openSettings() },
]
