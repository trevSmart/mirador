import type { ChannelKey } from '../api/types'
import type { SfSprite } from '../components/ds/SfIcon'
import { channelLabel } from './format'

/* Resolució de la icona d'OBJECTE d'un work item. Els sprites standard i
   custom s'empaqueten COMPLETS (public/slds/), així que qualsevol SObject
   d'una org resol — inclosos objectes custom.

   El color NO es resol aquí: la icona d'un tipus d'objecte porta el color
   oficial SLDS (classe generada a icons.css); la icona d'un REGISTRE la tinta
   el caller amb colorFromRecordId(id). Convenció completa: docs/icons.md */

export interface ResolvedObjectIcon {
  sprite: SfSprite
  symbol: string
}

const CHANNEL_ICON: Record<ChannelKey, ResolvedObjectIcon> = {
  veu: { sprite: 'standard', symbol: 'voice_call' },
  chat: { sprite: 'standard', symbol: 'messaging_session' },
  email: { sprite: 'standard', symbol: 'email' },
  wa: { sprite: 'standard', symbol: 'messaging_session' },
  cas: { sprite: 'standard', symbol: 'case' },
}

const DEFAULT_ICON: ResolvedObjectIcon = {
  sprite: 'standard',
  symbol: 'case',
}

function isSfSprite(value: string | null | undefined): value is SfSprite {
  // Només standard/custom: el themeInfo d'un SObject no emet altres famílies,
  // i són els únics sprites empaquetats. Qualsevol altra cosa cau al fallback.
  return value === 'standard' || value === 'custom'
}

/** Parse a Lightning icon name (standard:case, custom:custom78). */
function parseIconName(iconName: string): ResolvedObjectIcon | null {
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

/** Resolve the SLDS object icon for a work item record. */
export function resolveWorkItemIcon(item: WorkItemIconInput): ResolvedObjectIcon {
  if (item.iconName) {
    const parsed = parseIconName(item.iconName)
    if (parsed) return parsed
  }

  if (item.iconSprite && item.iconSymbol && isSfSprite(item.iconSprite)) {
    return { sprite: item.iconSprite, symbol: item.iconSymbol }
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
