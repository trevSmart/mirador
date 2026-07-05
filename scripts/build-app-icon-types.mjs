#!/usr/bin/env node
/**
 * build-app-icon-types.mjs
 *
 * Genera `src/components/ds/app-icon-names.generated.ts` amb la union
 * `AppIconName` a partir dels fitxers de `src/assets/icons/*.svg`
 * (nom de fitxer sense extensió = nom d'icona), i valida que cada SVG està
 * normalitzat com AppIcon espera:
 *
 *   - té `viewBox` (escala pel container)
 *   - NO té `width`/`height` a l'<svg> arrel (la mida la posa AppIcon)
 *   - usa `currentColor` (hereta el color del context)
 *
 * L'output es committeja. Re-executa'l quan afegeixis o esborris una icona:
 *
 *   npm run icons:app
 */

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ICONS_DIR = join(ROOT, 'src', 'assets', 'icons')
const OUT_FILE = join(ROOT, 'src', 'components', 'ds', 'app-icon-names.generated.ts')

async function main() {
  const files = (await readdir(ICONS_DIR)).filter((f) => f.endsWith('.svg')).sort()
  if (files.length === 0) {
    console.error(`✗ Cap SVG a ${ICONS_DIR}`)
    process.exit(1)
  }

  const problems = []
  for (const file of files) {
    const content = await readFile(join(ICONS_DIR, file), 'utf8')
    const rootTag = content.match(/<svg\b[^>]*>/)?.[0] ?? ''
    if (!/viewBox="/.test(rootTag)) problems.push(`${file}: falta viewBox a l'<svg> arrel`)
    if (/\s(width|height)="/.test(rootTag))
      problems.push(`${file}: l'<svg> arrel no ha de portar width/height`)
    if (!content.includes('currentColor'))
      problems.push(`${file}: ha d'usar currentColor (fill o stroke)`)
  }
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`)
    process.exit(1)
  }

  const names = files.map((f) => f.replace(/\.svg$/, ''))
  const out = `// GENERAT per scripts/build-app-icon-types.mjs — NO EDITAR A MÀ.
// Nom d'icona = nom de fitxer (sense .svg) a src/assets/icons/.
// Després d'afegir o esborrar una icona: npm run icons:app

export type AppIconName =
${names.map((n) => `  | '${n}'`).join('\n')}

export const APP_ICON_NAMES: readonly AppIconName[] = [
${names.map((n) => `  '${n}',`).join('\n')}
]
`
  await writeFile(OUT_FILE, out, 'utf8')
  console.log(`✓ app-icon-names.generated.ts — ${names.length} icones`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
