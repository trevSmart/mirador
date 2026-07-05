/* Model de les icones d'OBJECTE Salesforce: tipus, mapa de noms lògics i
   derivació de la classe de color oficial. El render és a SfIcon.tsx.
   Convenció completa: docs/icons.md */

import type { ChannelKey } from '../../api/types'

export type SfSprite = 'standard' | 'custom'

/** Mides nominals SLDS. */
export type SfIconSize = 'xx-small' | 'x-small' | 'small' | 'medium' | 'large'

export type SfIconName =
  | 'home'
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
  | 'space'
  | 'spaceEditor'

interface NamedIcon {
  sprite: SfSprite
  symbol: string
}

/** Única font de veritat nom lògic → icona d'objecte. */
export const NAMED: Record<SfIconName, NamedIcon> = {
  home:        { sprite: 'standard', symbol: 'home' },
  voice:       { sprite: 'standard', symbol: 'voice_call' },
  chat:        { sprite: 'standard', symbol: 'messaging_session' },
  email:       { sprite: 'standard', symbol: 'email' },
  whatsapp:    { sprite: 'standard', symbol: 'messaging_session' },
  case:        { sprite: 'standard', symbol: 'case' },
  queue:       { sprite: 'standard', symbol: 'queue' },
  skill:       { sprite: 'standard', symbol: 'skill' },
  user:        { sprite: 'standard', symbol: 'user' },
  work:        { sprite: 'standard', symbol: 'work_order_item' },
  agent:       { sprite: 'custom',   symbol: 'custom103' },
  space:       { sprite: 'standard', symbol: 'business_unit' },
  spaceEditor: { sprite: 'custom',   symbol: 'custom83' },
}

/** Canal Omni → nom lògic d'icona. */
export const CHANNEL: Record<ChannelKey, SfIconName> = {
  veu:  'voice',
  chat: 'chat',
  email:'email',
  wa:   'whatsapp',
  cas:  'case',
}

/**
 * Classe de color oficial SLDS per a una icona d'objecte.
 * standard: 'voice_call' → 'slds-icon-standard-voice-call' (guions baixos → guions)
 * custom:   'custom103'  → 'slds-icon-custom-103' (el CSS oficial usa només el número)
 */
export function sfIconColorClass(sprite: SfSprite, symbol: string): string {
  const suffix =
    sprite === 'custom' ? symbol.replace(/^custom/, '') : symbol.replace(/_/g, '-')
  return `slds-icon-${sprite}-${suffix}`
}
