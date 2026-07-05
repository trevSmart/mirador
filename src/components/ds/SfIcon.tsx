import type { CSSProperties } from 'react'
import type { ChannelKey } from '../../api/types'
import {
  CHANNEL,
  NAMED,
  sfIconColorClass,
  type SfIconName,
  type SfIconSize,
  type SfSprite,
} from './sf-icon-model'

export type { SfIconName, SfIconSize, SfSprite }

/* SfIcon — icona d'OBJECTE Salesforce (tile de color), renderitzada des dels
   sprites SLDS COMPLETS empaquetats a `public/slds/` (standard.svg, custom.svg).
   Qualsevol símbol d'SObject d'una org resol — inclosos objectes custom.

   Color del tile:
   - per defecte, el color OFICIAL SLDS de la icona (classe slds-icon-{sprite}-{símbol}
     del icons.css generat);
   - per a icones que representen un REGISTRE (queue, skill, work item…), el
     caller el tinta amb `bg={colorFromRecordId(id)}`.

   Per a glyphs monocroms de chrome useu AppIcon. Convenció completa: docs/icons.md */

/** Mides SLDS nominals → píxels (per compatibilitat amb prop `size` numèric). */
const SIZE_PX: Record<SfIconSize, number> = {
  'xx-small': 14,  // 0.875rem
  'x-small':  16,  // 1rem
  small:      24,  // 1.5rem
  medium:     32,  // 2rem
  large:      48,  // 3rem
}

interface SfIconProps {
  /** Named shortcut (voice/chat/case/queue/…). */
  name?: SfIconName
  /** Omni-channel key, mapped to a named shortcut. */
  channel?: ChannelKey
  /** Sprite set — use with `symbol` to reach any icon directly. */
  sprite?: SfSprite
  /** Symbol id inside the sprite (e.g. 'account', 'custom47'). */
  symbol?: string
  /**
   * Mida SLDS nominal: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'.
   * Genera la classe slds-icon_{size} sobre l'SVG.
   * Si no s'indica, s'usa 'medium' (2rem).
   */
  sldsSize?: SfIconSize
  /**
   * Mida en píxels del tile. Té prioritat sobre `sldsSize`.
   * No emet classes SLDS de mida.
   */
  size?: number
  radius?: number
  /**
   * Tint per REGISTRE (normalment colorFromRecordId). Quan s'indica, s'aplica
   * inline i anul·la el color oficial SLDS de la classe.
   */
  bg?: string
  style?: CSSProperties
  className?: string
}

interface Resolved {
  sprite: SfSprite
  symbol: string
}

function resolve({ name, channel, sprite, symbol }: SfIconProps): Resolved {
  if (sprite && symbol) return { sprite, symbol }
  const key: SfIconName = channel ? CHANNEL[channel] : (name ?? 'case')
  return NAMED[key]
}

/**
 * SfIcon — Salesforce Lightning object icon renderitzat amb classes SLDS oficials.
 *
 * HTML emès:
 *   <span class="slds-icon_container slds-icon-standard-case">
 *     <svg class="slds-icon slds-icon_small" aria-hidden="true">
 *       <use href="/slds/standard.svg#case" />
 *     </svg>
 *   </span>
 */
export function SfIcon({
  name,
  channel,
  sprite,
  symbol,
  sldsSize,
  size,
  radius,
  bg,
  style = {},
  className,
}: SfIconProps) {
  const ic = resolve({ name, channel, sprite, symbol })

  const href = `/slds/${ic.sprite}.svg#${ic.symbol}`

  // Classe de mida SLDS sobre l'SVG
  const sizeClass = size == null
    ? `slds-icon_${sldsSize ?? 'medium'}`
    : undefined

  // Mida inline quan s'usa el prop `size` numèric (compatibilitat)
  const px = size ?? (sldsSize ? SIZE_PX[sldsSize] : SIZE_PX.medium)

  const containerClasses = [
    'slds-icon_container',
    sfIconColorClass(ic.sprite, ic.symbol),
    className,
  ].filter(Boolean).join(' ')

  // Estils inline: només els que el CSS SLDS no cobreix
  const containerStyle: CSSProperties = {}
  if (bg) {
    // Tint per registre: anul·la el color oficial de la classe
    containerStyle.backgroundColor = bg
  }
  if (size != null) {
    // Mida numèrica: el tile fa exactament `size` i el glyph hi queda centrat
    containerStyle.width = px
    containerStyle.height = px
  }
  if (radius != null) {
    containerStyle.borderRadius = radius
  }

  // SVG: classes SLDS si usem sldsSize; dimensions inline si usem `size` numèric.
  // El glyph omple el tile: l'artwork SLDS ja porta el marge dibuixat al viewBox.
  const svgClasses = ['slds-icon', sizeClass].filter(Boolean).join(' ')
  const svgStyle: CSSProperties = size != null
    ? { display: 'block', width: px, height: px }
    : { display: 'block' }

  return (
    <span
      className={containerClasses}
      style={{ ...containerStyle, ...style }}
    >
      <svg className={svgClasses} style={svgStyle} aria-hidden="true">
        <use href={href} />
      </svg>
    </span>
  )
}
