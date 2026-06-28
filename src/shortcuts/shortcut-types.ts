/* Tipus del sistema de dreceres de teclat globals. */

import type { PanelType } from '../panels/registry'

/** Accions que el provider injecta a cada drecera quan s'executa.
    Afegeix-hi camps a mesura que noves dreceres necessitin noves accions. */
export interface ShortcutContext {
  openSettings: () => void
  /** Obre (o revela si ja existeix) un panel pel seu tipus. */
  openPanel: (type: PanelType) => void
}

export interface Shortcut {
  /** Identificador estable, per a logs i depuració. */
  id: string
  /** Tecla en minúscula, comparada contra event.key.toLowerCase() (ex: 's'). */
  key: string
  /** Si cert, la drecera funciona encara que hi hagi un modal obert. Default: false. */
  allowInModal?: boolean
  /** Si cert, la drecera funciona encara que el focus sigui en un camp de text. Default: false. */
  allowInTextField?: boolean
  /** Acció a executar. */
  run: (ctx: ShortcutContext) => void
}
