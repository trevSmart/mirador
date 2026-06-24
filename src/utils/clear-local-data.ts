/* Esborra les dades locals de l'app i deixa l'estat com el d'una primera
   obertura. Tots els valors persistits per Mirador (preferències, sessió OAuth,
   layout, recents, mode desenvolupador…) comparteixen el prefix "mirador", així
   que els eliminem de localStorage i sessionStorage sense tocar res que pugui
   pertànyer a altres orígens. El plànol de planta es preserva expressament. */

import { STORAGE_KEY as FLOOR_PLAN_KEY } from '../floor/floor-plan-repository'

const APP_PREFIX = 'mirador'

/* Claus que es mantenen tot i tenir el prefix de l'app: el plànol de planta no
   s'esborra en reiniciar les dades locals. */
const PRESERVED_KEYS = new Set<string>([FLOOR_PLAN_KEY])

function clearStore(store: Storage): void {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key && key.toLowerCase().startsWith(APP_PREFIX) && !PRESERVED_KEYS.has(key)) keys.push(key)
  }
  keys.forEach((key) => store.removeItem(key))
}

/** Buida les dades locals de Mirador. No recarrega la pàgina. */
export function clearLocalData(): void {
  try {
    clearStore(window.localStorage)
  } catch {
    /* localStorage pot no estar disponible (mode privat); ignorem-ho. */
  }
  try {
    clearStore(window.sessionStorage)
  } catch {
    /* idem per a sessionStorage. */
  }
}
