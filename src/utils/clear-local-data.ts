/* Esborra les dades locals de l'app i deixa l'estat com el d'una primera
   obertura. Tots els valors persistits per Mirador (preferències, sessió OAuth,
   layout, recents, mode desenvolupador…) comparteixen el prefix "mirador", així
   que els eliminem de localStorage i sessionStorage sense tocar res que pugui
   pertànyer a altres orígens. El plànol viu ara a l'org (Place__c/Space__c), no
   a localStorage, per la qual cosa no cal preservar-lo aquí. */

const APP_PREFIX = 'mirador'

function clearStore(store: Storage): void {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key && key.toLowerCase().startsWith(APP_PREFIX)) keys.push(key)
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
