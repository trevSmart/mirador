import type { ChannelKey } from '../api/types'
import type { SfSprite } from '../components/ds/SfIcon'

export interface ResolvedObjectIcon {
  sprite: SfSprite
  symbol: string
  tint: string
}

const OBJECT_TINTS: Record<string, string> = {
  case: 'var(--pa-ic-case)',
  call: 'var(--pa-ic-voice)',
  messaging: 'var(--pa-ic-whatsapp)',
  live_chat: 'var(--pa-ic-chat)',
  messaging_session: 'var(--pa-ic-whatsapp)',
  voice_call: 'var(--pa-ic-voice)',
  email: 'var(--pa-ic-email)',
  lead: 'var(--pa-ic-work)',
  social: 'var(--pa-ic-chat)',
  task: 'var(--pa-ic-work)',
  orders: 'var(--pa-ic-work)',
}

const CHANNEL_ICON: Record<ChannelKey, ResolvedObjectIcon> = {
  veu: { sprite: 'standard', symbol: 'call', tint: 'var(--pa-ic-voice)' },
  chat: { sprite: 'standard', symbol: 'messaging_session', tint: 'var(--pa-ic-chat)' },
  email: { sprite: 'standard', symbol: 'email', tint: 'var(--pa-ic-email)' },
  wa: { sprite: 'standard', symbol: 'messaging_session', tint: 'var(--pa-ic-whatsapp)' },
  cas: { sprite: 'standard', symbol: 'case', tint: 'var(--pa-ic-case)' },
}

const DEFAULT_ICON: ResolvedObjectIcon = {
  sprite: 'standard',
  symbol: 'case',
  tint: 'var(--pa-ic-case)',
}

function tintForSymbol(symbol: string): string {
  return OBJECT_TINTS[symbol] ?? 'var(--pa-ic-work)'
}

function isSfSprite(value: string | null | undefined): value is SfSprite {
  return value === 'standard' || value === 'custom' || value === 'action' || value === 'doctype' || value === 'utility'
}

/** Parse a Lightning icon name (standard:case, custom:custom78). */
export function parseIconName(iconName: string): { sprite: SfSprite; symbol: string } | null {
  const colon = iconName.indexOf(':')
  if (colon <= 0) return null
  const sprite = iconName.slice(0, colon)
  const symbol = iconName.slice(colon + 1)
  if (!symbol || !isSfSprite(sprite)) return null
  return { sprite, symbol }
}

export interface WorkItemIconInput {
  channelKey: ChannelKey
  iconName?: string | null
  objectApiName?: string | null
  iconSprite?: string | null
  iconSymbol?: string | null
}

/** Resolve the SLDS icon for a work item record. */
export function resolveWorkItemIcon(item: WorkItemIconInput): ResolvedObjectIcon {
  if (item.iconName) {
    const parsed = parseIconName(item.iconName)
    if (parsed) {
      return { ...parsed, tint: tintForSymbol(parsed.symbol) }
    }
  }

  if (item.iconSprite && item.iconSymbol && isSfSprite(item.iconSprite)) {
    return {
      sprite: item.iconSprite,
      symbol: item.iconSymbol,
      tint: tintForSymbol(item.iconSymbol),
    }
  }

  return CHANNEL_ICON[item.channelKey] ?? DEFAULT_ICON
}

/** Mock/API seed helper — icon fields for a channel-backed work item. */
export function workItemIconFields(channelKey: ChannelKey): {
  objectApiName: string
  iconName: string
  iconSprite: SfSprite
  iconSymbol: string
} {
  const icon = CHANNEL_ICON[channelKey]
  return {
    objectApiName:
      channelKey === 'veu'
        ? 'VoiceCall'
        : channelKey === 'chat' || channelKey === 'wa'
          ? 'MessagingSession'
          : channelKey === 'email'
              ? 'EmailMessage'
              : 'Case',
    iconName: `${icon.sprite}:${icon.symbol}`,
    iconSprite: icon.sprite,
    iconSymbol: icon.symbol,
  }
}
