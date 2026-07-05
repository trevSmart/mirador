import type { CSSProperties } from 'react'
import { appIconRegistry } from './app-icon-registry'
import type { AppIconName } from './app-icon-names.generated'

/* AppIcon — icones pròpies de la app (glyphs monocroms de chrome: tancar,
   chevron, refresh, settings…). Una icona = un fitxer SVG a
   `src/assets/icons/`, normalitzat (viewBox sense width/height,
   currentColor). El nom de la icona és el nom del fitxer.

   Per a icones d'objecte Salesforce (tiles de color standard/custom) useu
   SfIcon. Convenció completa: docs/icons.md */

interface AppIconProps {
  name: AppIconName
  /** Mida en px del glyph (amplada = alçada). Default 16. */
  size?: number
  /** Nom accessible; si s'omet, la icona és decorativa (aria-hidden). */
  title?: string
  className?: string
  style?: CSSProperties
}

export function AppIcon({ name, size = 16, title, className, style }: AppIconProps) {
  const svg = appIconRegistry[name]
  if (import.meta.env.DEV && !svg) {
    console.error(`AppIcon: icona desconeguda "${name}" (no és a src/assets/icons/)`)
  }

  const a11y = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': true as const }

  return (
    <span
      className={className ? `app-icon ${className}` : 'app-icon'}
      style={{ width: size, height: size, ...style }}
      {...a11y}
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  )
}
