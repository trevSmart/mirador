import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { SfIcon } from './SfIcon'
import { PreferencesContext, type PreferencesContextValue } from '../../settings/preferences-context'
import { PREFERENCES_DEFAULTS } from '../../settings/preferences'
import { colorFromRecordId } from '../../utils/color-from-string'

/* El tint d'una icona de registre depèn de la preferència `tintRecordIcons`:
   activada → fons = colorFromRecordId(id); desactivada → sense fons inline, així
   la classe SLDS deixa el color oficial de l'objecte. */

const QUEUE_ID = '00G5f000004aBcDEAU'

function withPref(tintRecordIcons: boolean) {
  const value: PreferencesContextValue = {
    prefs: { ...PREFERENCES_DEFAULTS, tintRecordIcons },
    save: () => {},
  }
  return ({ children }: { children: ReactNode }) => (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  )
}

function tile(container: HTMLElement): HTMLElement {
  return container.querySelector('.slds-icon_container') as HTMLElement
}

/** El mateix color tal com el retorna el CSSOM (jsdom retalla els zeros finals
    de l'oklch()), per poder comparar-lo amb un estil inline ja aplicat. */
function asCssColor(color: string): string {
  const probe = document.createElement('div')
  probe.style.backgroundColor = color
  return probe.style.backgroundColor
}

describe('SfIcon — tint per registre', () => {
  it('tenyeix la icona amb el color del registre quan la preferència és activa', () => {
    const { container } = render(<SfIcon name="queue" recordId={QUEUE_ID} />, {
      wrapper: withPref(true),
    })
    expect(tile(container).style.backgroundColor).toBe(asCssColor(colorFromRecordId(QUEUE_ID)))
  })

  it('deixa el color oficial SLDS quan la preferència és desactivada', () => {
    const { container } = render(<SfIcon name="queue" recordId={QUEUE_ID} />, {
      wrapper: withPref(false),
    })
    expect(tile(container).style.backgroundColor).toBe('')
  })

  it('tenyeix per defecte quan no hi ha PreferencesProvider', () => {
    const { container } = render(<SfIcon name="queue" recordId={QUEUE_ID} />)
    expect(tile(container).style.backgroundColor).toBe(asCssColor(colorFromRecordId(QUEUE_ID)))
  })

  it('`bg` és un override explícit i ignora la preferència', () => {
    const { container } = render(<SfIcon name="queue" recordId={QUEUE_ID} bg="rgb(1, 2, 3)" />, {
      wrapper: withPref(false),
    })
    expect(tile(container).style.backgroundColor).toBe('rgb(1, 2, 3)')
  })
})
