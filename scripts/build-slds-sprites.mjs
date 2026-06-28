#!/usr/bin/env node
/**
 * build-slds-sprites.mjs
 *
 * Genera sprites SLDS *subset* a `public/slds/` a partir dels sprites complets
 * que guardem com a recurs de desenvolupament a `slds-source/`.
 *
 * Els sprites oficials de SLDS pesen ~430 KiB cadascun i contenen centenars de
 * símbols. L'app només en fa servir un grapat, així que servir-los sencers
 * descarrega ~1,3 MiB per pintar una vintena d'icones. Aquest script extreu
 * únicament els símbols que se li passen i escriu un sprite minúscul per cada
 * família (`standard.svg`, `utility.svg`, …) mantenint els mateixos `href`
 * (`/slds/standard.svg#case`), de manera que el codi de l'app no canvia.
 *
 * Ús:
 *   node scripts/build-slds-sprites.mjs standard#case standard#queue utility#metrics custom#custom83
 *   node scripts/build-slds-sprites.mjs --from slds-source/icons.txt
 *
 * Cada argument és una parella `sprite#symbol`. Es poden barrejar famílies;
 * l'script les agrupa i genera un fitxer per família. Amb `--from <fitxer>`
 * llegeix la llista d'un fitxer (una parella per línia; # i línies buides
 * s'ignoren), que és com l'invoca `npm run slds:sprites`.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = join(ROOT, 'slds-source')
const OUT_DIR = join(ROOT, 'public', 'slds')

/** Capçalera del wrapper <svg> tal com el serveix SLDS (display:none l'amaga). */
const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" display="none">'
const SVG_CLOSE = '</svg>'

/**
 * Extreu el bloc `<symbol …>…</symbol>` amb l'id demanat del contingut d'un
 * sprite. Retorna null si no hi és. Tolerant amb atributs en qualsevol ordre.
 */
function extractSymbol(spriteContent, symbolId) {
  // Cerca l'obertura de qualsevol <symbol …> i comprova si conté id="symbolId".
  const openRe = /<symbol\b[^>]*>/g
  let match
  while ((match = openRe.exec(spriteContent)) !== null) {
    const openTag = match[0]
    const idMatch = openTag.match(/\bid="([^"]+)"/)
    if (!idMatch || idMatch[1] !== symbolId) continue
    const start = match.index
    const end = spriteContent.indexOf('</symbol>', start)
    if (end === -1) return null
    return spriteContent.slice(start, end + '</symbol>'.length)
  }
  return null
}

async function main() {
  let args = process.argv.slice(2)

  // `--from <fitxer>`: llegeix les parelles d'un fitxer (una per línia).
  const fromIdx = args.indexOf('--from')
  if (fromIdx !== -1) {
    const filePath = args[fromIdx + 1]
    if (!filePath) {
      console.error('✗ --from requereix una ruta de fitxer')
      process.exit(1)
    }
    const raw = await readFile(join(ROOT, filePath), 'utf8')
    args = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  }

  if (args.length === 0) {
    console.error(
      'Ús: node scripts/build-slds-sprites.mjs <sprite#symbol> [<sprite#symbol> …]'
    )
    console.error('     node scripts/build-slds-sprites.mjs --from slds-source/icons.txt')
    process.exit(1)
  }

  // Agrupa els símbols demanats per família de sprite.
  /** @type {Map<string, Set<string>>} */
  const bySprite = new Map()
  for (const arg of args) {
    const [sprite, symbol] = arg.split('#')
    if (!sprite || !symbol) {
      console.error(`Argument invàlid: "${arg}" (format esperat sprite#symbol)`)
      process.exit(1)
    }
    if (!bySprite.has(sprite)) bySprite.set(sprite, new Set())
    bySprite.get(sprite).add(symbol)
  }

  let totalIn = 0
  let totalOut = 0

  for (const [sprite, symbols] of bySprite) {
    const sourcePath = join(SOURCE_DIR, `${sprite}.svg`)
    if (!existsSync(sourcePath)) {
      console.error(`✗ No trobo el sprite font: ${sourcePath}`)
      process.exit(1)
    }
    const source = await readFile(sourcePath, 'utf8')
    totalIn += Buffer.byteLength(source)

    const pieces = []
    const missing = []
    for (const symbol of [...symbols].sort()) {
      const block = extractSymbol(source, symbol)
      if (block) pieces.push(block)
      else missing.push(symbol)
    }

    if (missing.length) {
      console.error(
        `✗ ${sprite}.svg: símbols no trobats al sprite font: ${missing.join(', ')}`
      )
      process.exit(1)
    }

    const out = SVG_OPEN + pieces.join('') + SVG_CLOSE
    const outPath = join(OUT_DIR, `${sprite}.svg`)
    await writeFile(outPath, out, 'utf8')
    totalOut += Buffer.byteLength(out)

    const kib = (Buffer.byteLength(out) / 1024).toFixed(1)
    console.log(`✓ ${sprite}.svg — ${pieces.length} símbols, ${kib} KiB`)
  }

  const inKib = (totalIn / 1024).toFixed(0)
  const outKib = (totalOut / 1024).toFixed(1)
  console.log(`\nTotal: ${outKib} KiB (des de ${inKib} KiB de sprites complets)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
