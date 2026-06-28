import type { ChannelKey } from '../api/types'
import type { SfSprite } from '../components/ds/SfIcon'
import { channelLabel } from './format'

export interface ResolvedObjectIcon {
  sprite: SfSprite
  symbol: string
  tint: string
}

const OBJECT_TINTS: Record<string, string> = {
  case: 'var(--mi-ic-case)',
  call: 'var(--mi-ic-voice)',
  messaging: 'var(--mi-ic-whatsapp)',
  live_chat: 'var(--mi-ic-chat)',
  messaging_session: 'var(--mi-ic-whatsapp)',
  voice_call: 'var(--mi-ic-voice)',
  email: 'var(--mi-ic-email)',
  lead: 'var(--mi-ic-work)',
  social: 'var(--mi-ic-chat)',
  task: 'var(--mi-ic-work)',
  orders: 'var(--mi-ic-work)',
}

const CHANNEL_ICON: Record<ChannelKey, ResolvedObjectIcon> = {
  veu: { sprite: 'standard', symbol: 'call', tint: 'var(--mi-ic-voice)' },
  chat: { sprite: 'standard', symbol: 'messaging_session', tint: 'var(--mi-ic-chat)' },
  email: { sprite: 'standard', symbol: 'email', tint: 'var(--mi-ic-email)' },
  wa: { sprite: 'standard', symbol: 'messaging_session', tint: 'var(--mi-ic-whatsapp)' },
  cas: { sprite: 'standard', symbol: 'case', tint: 'var(--mi-ic-case)' },
}

const DEFAULT_ICON: ResolvedObjectIcon = {
  sprite: 'standard',
  symbol: 'case',
  tint: 'var(--mi-ic-case)',
}

function tintForSymbol(symbol: string): string {
  return OBJECT_TINTS[symbol] ?? 'var(--mi-ic-work)'
}

function isSfSprite(value: string | null | undefined): value is SfSprite {
  return value === 'standard' || value === 'custom' || value === 'action' || value === 'doctype' || value === 'utility'
}

/** Parse a Lightning icon name (standard:case, custom:custom78). */
function parseIconName(iconName: string): { sprite: SfSprite; symbol: string } | null {
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

const OBJECT_LABELS: Record<string, string> = {
  VoiceCall: 'Trucada de veu',
  Case: 'Cas',
  MessagingSession: 'Missatgeria',
  EmailMessage: 'Correu',
  LiveChatTranscript: 'Xat en directe',
  Lead: 'Oportunitat',
}

/** Human-readable label for a work item's backing SObject. Falls back to the
    raw objectApiName, and finally to the channel label when none is set. */
export function objectLabel(item: {
  objectApiName?: string | null
  channelKey: ChannelKey
}): string {
  if (item.objectApiName) {
    return OBJECT_LABELS[item.objectApiName] ?? item.objectApiName
  }
  return channelLabel(item.channelKey)
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
