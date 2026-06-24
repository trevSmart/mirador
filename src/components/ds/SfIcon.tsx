import type { CSSProperties } from 'react'
import type { ChannelKey } from '../../api/types'

/* Salesforce Lightning Design System icons, rendered from the SLDS sprites
   shipped in `public/slds/`. Emet markup amb les classes SLDS oficials:
   slds-icon_container, slds-icon-{sprite}-{symbol}, slds-icon, slds-icon_{size}

   Two visual families:
   - utility  → monochrome glyphs, slds-current-color (fills with currentColor)
   - standard / action / custom / doctype → white artwork on a colored tile */

export type SfSprite = 'utility' | 'standard' | 'action' | 'custom' | 'doctype'

/** Mides nominals SLDS. */
export type SfIconSize = 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'

const TILED_SPRITES: ReadonlySet<SfSprite> = new Set([
  'standard',
  'action',
  'custom',
  'doctype',
])

/* ── Named shortcuts ──────────────────────────────────────────────────── */

export type SfIconName =
  | 'home'
  | 'insights'
  | 'voice'
  | 'chat'
  | 'email'
  | 'whatsapp'
  | 'case'
  | 'queue'
  | 'skill'
  | 'user'
  | 'work'
  | 'agent'
  | 'floor'
  | 'floorEditor'

interface NamedIcon {
  sprite: SfSprite
  symbol: string
}

const NAMED: Record<SfIconName, NamedIcon> = {
  home:        { sprite: 'standard', symbol: 'agent_home' },
  insights:    { sprite: 'utility',  symbol: 'metrics' },
  voice:       { sprite: 'standard', symbol: 'voice_call' },
  chat:        { sprite: 'standard', symbol: 'live_chat' },
  email:       { sprite: 'standard', symbol: 'email' },
  whatsapp:    { sprite: 'standard', symbol: 'messaging_session' },
  case:        { sprite: 'standard', symbol: 'case' },
  queue:       { sprite: 'standard', symbol: 'queue' },
  skill:       { sprite: 'standard', symbol: 'skill' },
  user:        { sprite: 'standard', symbol: 'user' },
  work:        { sprite: 'standard', symbol: 'work_order_item' },
  agent:       { sprite: 'custom',   symbol: 'custom103' },
  floor:       { sprite: 'standard', symbol: 'service_territory' },
  floorEditor: { sprite: 'standard', symbol: 'maintenance_plan' },
}

const CHANNEL: Record<ChannelKey, SfIconName> = {
  veu:  'voice',
  chat: 'chat',
  email:'email',
  wa:   'whatsapp',
  cas:  'case',
}

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
  /** Symbol id inside the sprite (e.g. 'account', 'refresh', 'edit'). */
  symbol?: string
  /**
   * Mida SLDS nominal: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'.
   * Genera la classe slds-icon_{size} sobre l'SVG.
   * Si no s'indica, s'usa 'medium' (2rem).
   */
  sldsSize?: SfIconSize
  /**
   * Mida en píxels. Té prioritat sobre `sldsSize`.
   * Per compatibilitat amb codi existent; no emet classes SLDS de mida.
   */
  size?: number
  radius?: number
  /**
   * Override del color de fons (icones tiled) o del glyph (utility).
   * Quan s'indica, s'aplica inline i anul·la el color SLDS de la classe.
   */
  bg?: string
  /** Force tile on/off. Per defecte: tiled per a standard/action/custom/doctype. */
  tile?: boolean
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

/** symbol 'voice_call' → 'voice-call' (classe SLDS usa guions) */
function symbolToClass(symbol: string): string {
  return symbol.replace(/_/g, '-')
}

/**
 * SfIcon — Salesforce Lightning icon renderitzat amb classes SLDS oficials.
 *
 * HTML emès (icona tiled):
 *   <span class="slds-icon_container slds-icon-standard-case">
 *     <svg class="slds-icon slds-icon_small" aria-hidden="true">
 *       <use href="/slds/standard.svg#case" />
 *     </svg>
 *   </span>
 *
 * HTML emès (utility):
 *   <span class="slds-icon_container slds-current-color">
 *     <svg class="slds-icon slds-icon_small" aria-hidden="true">
 *       <use href="/slds/utility.svg#metrics" />
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
  tile,
  style = {},
  className,
}: SfIconProps) {
  const ic = resolve({ name, channel, sprite, symbol })
  const tiled = tile ?? TILED_SPRITES.has(ic.sprite)

  const href = `/slds/${ic.sprite}.svg#${ic.symbol}`

  // Classe de mida SLDS sobre l'SVG
  const sizeClass = size == null
    ? `slds-icon_${sldsSize ?? 'medium'}`
    : undefined

  // Mida inline quan s'usa el prop `size` numèric (compatibilitat)
  const px = size ?? (sldsSize ? SIZE_PX[sldsSize] : SIZE_PX.medium)

  // Classes del container
  const spriteColorClass = tiled
    ? `slds-icon-${ic.sprite}-${symbolToClass(ic.symbol)}`
    : 'slds-current-color'

  const containerClasses = [
    'slds-icon_container',
    spriteColorClass,
    className,
  ].filter(Boolean).join(' ')

  // Estils inline: només els que el CSS SLDS no cobreix
  const containerStyle: CSSProperties = {}
  if (bg) {
    // Override explícit del color
    containerStyle[tiled ? 'backgroundColor' : 'color'] = bg
  }
  if (size != null) {
    // Mida numèrica: el container s'adapta a l'SVG que fem inline
  }
  if (radius != null) {
    containerStyle.borderRadius = radius
  }

  // SVG: classes SLDS si usem sldsSize; dimensions inline si usem `size` numèric
  const svgClasses = ['slds-icon', sizeClass].filter(Boolean).join(' ')
  const svgStyle: CSSProperties = size != null
    ? { display: 'block', width: tiled ? px * 0.6 : px, height: tiled ? px * 0.6 : px }
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
