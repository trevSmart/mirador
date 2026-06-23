import type { CSSProperties } from 'react'
import type { ChannelKey } from '../../api/types'

/* Salesforce Lightning Design System icons, rendered from the SLDS sprites
   shipped in `public/slds/`. Each set is one sprite file of <symbol id="…">;
   we point an <svg><use href="/slds/<set>.svg#<symbol>"> at the one we want,
   so any icon of any set is reachable without copying path data by hand.

   Two visual families:
   - utility  → monochrome glyphs, painted with currentColor, no tile.
   - standard / action / custom / doctype → white artwork on a colored tile. */

export type SfSprite = 'utility' | 'standard' | 'action' | 'custom' | 'doctype'

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

interface SfIconProps {
  /** Named shortcut (voice/chat/case/queue/…). */
  name?: SfIconName
  /** Omni-channel key, mapped to a named shortcut. */
  channel?: ChannelKey
  /** Sprite set — use with `symbol` to reach any icon directly. */
  sprite?: SfSprite
  /** Symbol id inside the sprite (e.g. 'account', 'refresh', 'edit'). */
  symbol?: string
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
 *   <SfIcon name="queue" />                  // friendly shortcut
 *   <SfIcon channel="veu" />                 // Omni channel key
 *   <SfIcon sprite="utility" symbol="edit" />  // any icon of any set
 */
export function SfIcon({
  name,
  channel,
  sprite,
  symbol,
  size = 30,
  radius,
  bg,
  tile,
  style = {},
}: SfIconProps) {
  const ic = resolve({ name, channel, sprite, symbol })
  const tiled = tile ?? TILED_SPRITES.has(ic.sprite)
  const href = `/slds/${ic.sprite}.svg#${ic.symbol}`
  const glyphPad = tiled ? Math.round(size * 0.2) : 0

  const svg = (
    <svg
      width={size - glyphPad * 2}
      height={size - glyphPad * 2}
      fill={tiled ? '#fff' : 'currentColor'}
      aria-hidden="true"
    >
      <use href={href} />
    </svg>
  )

  if (!tiled) {
    return (
      <span
        style={{ display: 'inline-grid', placeItems: 'center', color: bg ?? ic.tint, ...style }}
      >
        {svg}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: radius != null ? radius : Math.round(size * 0.27),
        background: bg ?? ic.tint ?? 'var(--accent)',
        ...style,
      }}
    >
      {svg}
    </span>
  )
}
