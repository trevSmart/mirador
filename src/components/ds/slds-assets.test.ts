import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ChannelKey } from '../../api/types'
import { PANEL_DEFINITIONS } from '../../panels/registry'
import { workItemIconFields } from '../../utils/salesforce-object-icon'
import { NAMED, sfIconColorClass, type SfSprite } from './sf-icon-model'

/* Blindatge dels recursos SLDS empaquetats (public/slds/, generats per
   scripts/build-slds-assets.mjs): tota icona d'objecte referenciada
   estàticament al codi ha d'existir al sprite de la seva família i tenir la
   classe de color oficial a icons.css. Si falla: npm run slds:build */

const HERE = dirname(fileURLToPath(import.meta.url))
const SLDS_DIR = join(HERE, '..', '..', '..', 'public', 'slds')
const sprites: Record<SfSprite, string> = {
  standard: readFileSync(join(SLDS_DIR, 'standard.svg'), 'utf8'),
  custom: readFileSync(join(SLDS_DIR, 'custom.svg'), 'utf8'),
}
const iconsCss = readFileSync(join(SLDS_DIR, 'icons.css'), 'utf8')

function expectIconPackaged(sprite: SfSprite, symbol: string) {
  expect(
    sprites[sprite].includes(`id="${symbol}"`),
    `${sprite}.svg no conté el símbol "${symbol}"`
  ).toBe(true)
  const colorClass = `.${sfIconColorClass(sprite, symbol)} `
  expect(
    iconsCss.includes(colorClass),
    `icons.css no conté la classe de color "${colorClass.trim()}"`
  ).toBe(true)
}

describe('sprites i colors SLDS empaquetats', () => {
  it.each(Object.entries(NAMED))('NAMED.%s existeix al sprite i a icons.css', (_name, icon) => {
    expectIconPackaged(icon.sprite, icon.symbol)
  })

  it.each(
    PANEL_DEFINITIONS.filter((def) => 'sprite' in def.icon).map(
      (def) => [def.type, def.icon as { sprite: SfSprite; symbol: string }] as const
    )
  )('icona del panell %s existeix al sprite i a icons.css', (_type, icon) => {
    expectIconPackaged(icon.sprite, icon.symbol)
  })

  it.each(['veu', 'chat', 'email', 'wa', 'cas'] satisfies ChannelKey[])(
    'la icona del canal %s existeix al sprite i a icons.css',
    (channel) => {
      const fields = workItemIconFields(channel)
      expectIconPackaged(fields.iconSprite, fields.iconSymbol)
    }
  )

  it('icons.css té la regla slds-icon_medium i els colors complets', () => {
    expect(iconsCss).toContain('.slds-icon_medium')
    const standardCount = (iconsCss.match(/\.slds-icon-standard-/g) ?? []).length
    const customCount = (iconsCss.match(/\.slds-icon-custom-/g) ?? []).length
    expect(standardCount, 'colors standard incomplets — npm run slds:build').toBeGreaterThanOrEqual(600)
    expect(customCount, 'colors custom incomplets — npm run slds:build').toBeGreaterThanOrEqual(100)
  })
})
