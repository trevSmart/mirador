import type { CSSProperties } from 'react'
import type { ChannelKey } from '../../api/types'
import { sfIconColor } from '../../utils/sf-icon-color'
import type { SfIconName, SfSprite } from './SfIcon'

const NAMED: Record<SfIconName, { sprite: string; symbol: string }> = {
  home: { sprite: 'standard', symbol: 'home' },
  insights: { sprite: 'utility', symbol: 'metrics' },
  voice: { sprite: 'standard', symbol: 'voice_call' },
  chat: { sprite: 'standard', symbol: 'messaging_session' },
  email: { sprite: 'standard', symbol: 'email' },
  whatsapp: { sprite: 'standard', symbol: 'messaging_session' },
  case: { sprite: 'standard', symbol: 'case' },
  queue: { sprite: 'standard', symbol: 'queue' },
  skill: { sprite: 'standard', symbol: 'skill' },
  user: { sprite: 'standard', symbol: 'user' },
  work: { sprite: 'standard', symbol: 'work_order_item' },
  agent: { sprite: 'custom', symbol: 'custom103' },
  floor: { sprite: 'standard', symbol: 'business_unit' },
  floorEditor: { sprite: 'custom', symbol: 'custom83' },
}

const CHANNEL: Record<ChannelKey, SfIconName> = {
  veu: 'voice',
  chat: 'chat',
  email: 'email',
  wa: 'whatsapp',
  cas: 'case',
}

interface SfIconTileProps {
  name?: SfIconName
  channel?: ChannelKey
  sprite?: SfSprite
  symbol?: string
  size?: number
  bg?: string
  className?: string
  style?: CSSProperties
}

/** Colored SLDS tile — same markup as Panorama `sf-icon-tile`. */
export function SfIconTile({
  name,
  channel,
  sprite,
  symbol,
  size = 30,
  bg,
  className = 'sf-icon-tile',
  style = {},
}: SfIconTileProps) {
  const key: SfIconName = channel ? CHANNEL[channel] : (name ?? 'case')
  const ic = sprite && symbol ? { sprite, symbol } : NAMED[key]
  const href = `/slds/${ic.sprite}.svg#${ic.symbol}`
  const background = bg ?? sfIconColor(key)

  return (
    <span
      className={className}
      style={{ width: size, height: size, background, ...style }}
    >
      <svg className="sf-icon" aria-hidden="true">
        <use href={href} />
      </svg>
    </span>
  )
}
