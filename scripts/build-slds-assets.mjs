#!/usr/bin/env node
/**
 * build-slds-assets.mjs
 *
 * Genera els recursos SLDS empaquetats a `public/slds/` des del paquet npm
 * oficial `@salesforce-ux/design-system` (devDependency, versió pinnada):
 *
 *   - standard.svg  → sprite COMPLET d'icones d'objecte estàndard
 *   - custom.svg    → sprite COMPLET d'icones d'objecte custom
 *   - icons.css     → regles de container/mida + TOTES les classes de color
 *                     oficials `.slds-icon-{standard,custom}-*`
 *
 * Els sprites s'empaqueten sencers a propòsit: els usuaris poden configurar
 * qualsevol SObject (estàndard o custom) com a work item del seu routing, i el
 * detall del work item n'ha de poder resoldre la icona en temps d'execució.
 *
 * Els outputs es committegen. Re-executa'l només quan es faci bump de la versió
 * del paquet:
 *
 *   npm run slds:build
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PKG_DIR = join(ROOT, 'node_modules', '@salesforce-ux', 'design-system')
const OUT_DIR = join(ROOT, 'public', 'slds')

const SPRITES = ['standard', 'custom']

/** Mínims de classes de color esperades per família. Si el format del CSS del
    paquet canvia en un bump i la regex deixa de matxejar, fallem en sec en
    comptes d'escriure un icons.css buit. */
const MIN_COLOR_RULES = { standard: 600, custom: 100 }

/** Part fixa d'icons.css: container i mides que SfIcon emet com a classes. */
const FIXED_CSS = `/* GENERAT per scripts/build-slds-assets.mjs — NO EDITAR A MÀ.
   Font: @salesforce-ux/design-system (vegeu la versió a package.json).
   Regles de container/mida per a SfIcon + colors oficials de totes les icones
   d'objecte standard i custom. */

/* ── Container ──────────────────────────────────────────────────────────── */

.slds-icon_container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  line-height: 1;
  background-color: transparent;
}

.slds-icon_container_circle {
  border-radius: 50%;
  padding: 0.5rem;
}

/* ── Glyph SVG ──────────────────────────────────────────────────────────── */

.slds-icon {
  display: block;
  width: 2rem;
  height: 2rem;
  fill: rgb(255, 255, 255);
}

.slds-icon_xx-small { width: 0.875rem; height: 0.875rem; line-height: 1; }
.slds-icon_x-small  { width: 1rem;     height: 1rem;     line-height: 1; }
.slds-icon_small    { width: 1.5rem;   height: 1.5rem;   line-height: 1; }
.slds-icon_medium   { width: 2rem;     height: 2rem;     line-height: 1; }
.slds-icon_large    { width: 3rem;     height: 3rem; }

/* Utility icons: hereten el color del pare en comptes de blanc */
.slds-current-color .slds-icon { fill: currentColor; }

/* ── Colors oficials SLDS per icona d'objecte ───────────────────────────── */
`

/**
 * Extreu totes les regles `.slds-icon-{standard,custom}-X { background-color }`
 * del CSS del paquet i les emet en forma simple (sense les vars de tematització
 * --slds-c-icon-*, que no fem servir). Dedup per nom de classe.
 */
function extractColorRules(css) {
  const re = /\.slds-icon-(standard|custom)-([a-z0-9-]+)\{[^}]*?background-color:[^};]*?rgb\(([^)]+)\)/g
  const byFamily = { standard: new Map(), custom: new Map() }
  let match
  while ((match = re.exec(css)) !== null) {
    const [, family, name, rgb] = match
    if (!byFamily[family].has(name)) {
      byFamily[family].set(name, rgb.replace(/\s+/g, ' ').trim())
    }
  }
  return byFamily
}

async function main() {
  // 1. Sprites complets, tal qual els serveix el paquet (ja porten display="none").
  for (const sprite of SPRITES) {
    const source = join(PKG_DIR, 'assets', 'icons', `${sprite}-sprite`, 'svg', 'symbols.svg')
    const content = await readFile(source, 'utf8')
    if (!content.includes('display="none"')) {
      console.error(`✗ ${sprite}-sprite/svg/symbols.svg no porta display="none" a l'arrel`)
      process.exit(1)
    }
    const outPath = join(OUT_DIR, `${sprite}.svg`)
    await writeFile(outPath, content, 'utf8')
    const symbols = (content.match(/<symbol\b/g) ?? []).length
    const kib = (Buffer.byteLength(content) / 1024).toFixed(0)
    console.log(`✓ ${sprite}.svg — ${symbols} símbols, ${kib} KiB`)
  }

  // 2. icons.css: part fixa + colors extrets del CSS oficial.
  const cssSource = await readFile(
    join(PKG_DIR, 'assets', 'styles', 'salesforce-lightning-design-system.css'),
    'utf8'
  )
  const byFamily = extractColorRules(cssSource)

  for (const family of SPRITES) {
    const count = byFamily[family].size
    if (count < MIN_COLOR_RULES[family]) {
      console.error(
        `✗ Només ${count} classes de color ${family} extretes (mínim esperat ` +
          `${MIN_COLOR_RULES[family]}). Ha canviat el format del CSS del paquet?`
      )
      process.exit(1)
    }
  }

  const colorRules = SPRITES.flatMap((family) =>
    [...byFamily[family].entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rgb]) => `.slds-icon-${family}-${name} { background-color: rgb(${rgb}); }`)
  )

  const outCss = FIXED_CSS + '\n' + colorRules.join('\n') + '\n'
  await writeFile(join(OUT_DIR, 'icons.css'), outCss, 'utf8')
  console.log(
    `✓ icons.css — ${byFamily.standard.size} colors standard + ${byFamily.custom.size} custom, ` +
      `${(Buffer.byteLength(outCss) / 1024).toFixed(0)} KiB`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
