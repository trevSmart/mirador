/* Registre d'icones de la app: un fitxer SVG a `src/assets/icons/`
   = una icona, amb el nom de fitxer com a clau. Contingut estàtic del repo. */

const modules = import.meta.glob<string>('../../assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** nom de fitxer sense extensió → contingut SVG */
export const appIconRegistry: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, svg]) => [
    path.replace(/^.*\/([^/]+)\.svg$/, '$1'),
    svg,
  ])
)

/** Noms disponibles al registre real (per a tests de sincronia amb els tipus). */
export function appIconNames(): string[] {
  return Object.keys(appIconRegistry)
}

/** Contingut SVG cru d'una icona (per a tests de normalització). */
export function appIconSvg(name: string): string | undefined {
  return appIconRegistry[name]
}
