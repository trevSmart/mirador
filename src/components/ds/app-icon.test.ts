import { describe, expect, it } from 'vitest'
import { APP_ICON_NAMES } from './app-icon-names.generated'
import { appIconNames, appIconSvg } from './app-icon-registry'

/* Blindatge del sistema AppIcon: el registre real (fitxers a
   src/assets/icons/) i la union generada han d'anar sincronitzats, i
   cada SVG ha d'estar normalitzat. Si falla: npm run icons:app */

describe('AppIcon registry', () => {
  it('coincideix exactament amb APP_ICON_NAMES (regenera amb npm run icons:app)', () => {
    expect([...appIconNames()].sort()).toEqual([...APP_ICON_NAMES].sort())
  })

  it.each(APP_ICON_NAMES)('%s.svg està normalitzat', (name) => {
    const svg = appIconSvg(name)
    expect(svg, `${name}.svg no és al registre`).toBeDefined()
    const rootTag = svg!.match(/<svg\b[^>]*>/)?.[0] ?? ''
    expect(rootTag, 'falta viewBox').toMatch(/viewBox="/)
    expect(rootTag, "l'<svg> arrel no ha de portar width/height").not.toMatch(
      /\s(width|height)="/
    )
    expect(svg, 'ha d’usar currentColor').toContain('currentColor')
  })
})
