import type { CSSProperties } from 'react'
import type { ChannelKey } from '../../api/types'
import styles from './SfIcon.module.css'

/* Salesforce Lightning Design System icons, rendered from the SLDS sprites
   shipped in `public/slds/`. Each set is one sprite file of <symbol id="…">;
   we point an <svg><use href="/slds/<set>.svg#<symbol>"> at the one we want,
   so any icon of any set is reachable without copying path data by hand.

   Two visual families:
   - utility  → monochrome glyphs, painted with currentColor, no tile.
   - standard / action / custom / doctype → white artwork on a colored tile.

   Mides SLDS: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'
   Per compatibilitat, `size` numèric (píxels) segueix funcionant. */

export type SfSprite = 'utility' | 'standard' | 'action' | 'custom' | 'doctype'

/** Mides nominals SLDS (replica les classes slds-icon_*). */
export type SfIconSize = 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'

/** Sets whose artwork is white-on-tile (vs. monochrome utility glyphs). */
const TILED_SPRITES: ReadonlySet<SfSprite> = new Set([
  'standard',
  'action',
  'custom',
  'doctype',
])

/* ── Named shortcuts ─────────────────────────────────────────────────────
   Friendly aliases the app already uses, mapped to a concrete sprite+symbol
   plus the tile tint. Add an entry here to give an icon a stable short name;
   anything not listed is still reachable via `sprite` + `symbol`. */

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
  tint?: string
}

const NAMED: Record<SfIconName, NamedIcon> = {
  home: { sprite: 'standard', symbol: 'agent_home', tint: 'var(--pa-ic-user)' },
  insights: { sprite: 'utility', symbol: 'metrics' },
  voice: { sprite: 'standard', symbol: 'voice_call', tint: 'var(--pa-ic-voice)' },
  chat: { sprite: 'standard', symbol: 'live_chat', tint: 'var(--pa-ic-chat)' },
  email: { sprite: 'standard', symbol: 'email', tint: 'var(--pa-ic-email)' },
  whatsapp: { sprite: 'standard', symbol: 'messaging_session', tint: 'var(--pa-ic-whatsapp)' },
  case: { sprite: 'standard', symbol: 'case', tint: 'var(--pa-ic-case)' },
  queue: { sprite: 'standard', symbol: 'queue', tint: 'var(--pa-ic-queue)' },
  skill: { sprite: 'standard', symbol: 'skill', tint: 'var(--pa-ic-skill)' },
  user: { sprite: 'standard', symbol: 'user', tint: 'var(--pa-ic-user)' },
  work: { sprite: 'standard', symbol: 'work_order_item', tint: 'var(--pa-ic-work)' },
  agent: { sprite: 'custom', symbol: 'custom103', tint: 'var(--pa-ic-user)' },
  floor: { sprite: 'standard', symbol: 'service_territory', tint: 'var(--pa-ic-queue)' },
  floorEditor: { sprite: 'standard', symbol: 'maintenance_plan', tint: 'var(--pa-ic-skill)' },
}

/** Omni-channel key → named icon */
const CHANNEL: Record<ChannelKey, SfIconName> = {
  veu: 'voice',
  chat: 'chat',
  email: 'email',
  wa: 'whatsapp',
  cas: 'case',
}

/** Mides SLDS nominals → píxels equivalents (valors de SLDS v2.30.4). */
const SIZE_PX: Record<SfIconSize, number> = {
  'xx-small': 14,   // 0.875rem
  'x-small': 16,    // 1rem
  small: 24,        // 1.5rem
  medium: 32,       // 2rem
  large: 48,        // 3rem
}

const SIZE_CLASS: Record<SfIconSize, string> = {
  'xx-small': styles['size-xx-small'],
  'x-small': styles['size-x-small'],
  small: styles['size-small'],
  medium: styles['size-medium'],
  large: styles['size-large'],
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
   * Si s'usa `size` numèric (píxels), té prioritat per compatibilitat.
   */
  sldsSize?: SfIconSize
  /** Mida en píxels (compatibilitat). Si no s'indica, s'usa `sldsSize` o 'medium'. */
  size?: number
  radius?: number
  /** Tile background (tiled sets) or glyph color (utility). Overrides default. */
  bg?: string
  /** Force tile on/off. Defaults: tiled sets → on, utility → off. */
  tile?: boolean
  style?: CSSProperties
}

interface Resolved {
  sprite: SfSprite
  symbol: string
  tint?: string
}

/** Work out which sprite+symbol to draw from the various prop shapes. */
function resolve({ name, channel, sprite, symbol }: SfIconProps): Resolved {
  if (sprite && symbol) return { sprite, symbol }
  const key: SfIconName = channel ? CHANNEL[channel] : (name ?? 'case')
  return NAMED[key]
}

/**
 * SfIcon — a Salesforce Lightning icon drawn from the SLDS sprites.
 *
 * Three ways to pick the glyph:
 *   <SfIcon name="queue" />                    // friendly shortcut
 *   <SfIcon channel="veu" />                   // Omni channel key
 *   <SfIcon sprite="utility" symbol="edit" />  // any icon of any set
 *
 * Mides SLDS:
 *   <SfIcon name="queue" sldsSize="small" />   // 1rem / 16px
 *   <SfIcon name="queue" size={32} />          // píxels (compatibilitat)
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
}: SfIconProps) {
  const ic = resolve({ name, channel, sprite, symbol })
  const tiled = tile ?? TILED_SPRITES.has(ic.sprite)

  // Resolució de mida: `size` numèric té prioritat, sinó `sldsSize`, sinó 'medium'
  const resolvedSldsSize: SfIconSize | undefined =
    size == null ? (sldsSize ?? 'medium') : undefined
  const px = size ?? (resolvedSldsSize ? SIZE_PX[resolvedSldsSize] : 24)
  const sizeClass = resolvedSldsSize ? SIZE_CLASS[resolvedSldsSize] : undefined

  const href = `/slds/${ic.sprite}.svg#${ic.symbol}`

  // Amb mida SLDS nominal: el CSS gestiona les dimensions via classe
  // Amb mida numèrica: apliquem width/height inline directament
  const svgStyle: CSSProperties = sizeClass
    ? {}
    : { width: tiled ? px * 0.6 : px, height: tiled ? px * 0.6 : px }

  const svg = (
    <svg
      className={sizeClass ? styles.icon : undefined}
      style={{ display: 'block', fill: tiled ? '#fff' : 'currentColor', ...svgStyle }}
      aria-hidden="true"
    >
      <use href={href} />
    </svg>
  )

  const containerClasses = [
    styles.container,
    tiled ? styles.tiled : undefined,
    sizeClass,
  ]
    .filter(Boolean)
    .join(' ')

  if (!tiled) {
    return (
      <span
        className={containerClasses}
        style={{
          color: bg ?? ic.tint,
          ...(sizeClass ? {} : { width: px, height: px }),
          ...style,
        }}
      >
        {svg}
      </span>
    )
  }

  const borderRadius =
    radius != null
      ? radius
      : sizeClass
        ? undefined // el CSS aplica 0.25rem per defecte
        : Math.round(px * 0.27)

  return (
    <span
      className={containerClasses}
      style={{
        background: bg ?? ic.tint ?? 'var(--accent)',
        ...(sizeClass
          ? { borderRadius: radius != null ? radius : undefined }
          : { width: px, height: px, borderRadius }),
        ...style,
      }}
    >
      {svg}
    </span>
  )
}
