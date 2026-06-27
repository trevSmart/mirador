import type { SfIconName } from '../components/ds/SfIcon'

/** Salesforce Lightning object icon backgrounds (aligned with Panorama). */
const SF_ICON_COLORS: Partial<Record<SfIconName, string>> = {
  queue: '#5867E8',
  skill: '#F88962',
  user: '#34BECD',
  case: '#FF538A',
  voice: '#9050E9',
  chat: '#FF538A',
  email: '#95AEC5',
  whatsapp: '#1FA076',
  work: '#6CA1E9',
}

export function sfIconColor(name: SfIconName): string {
  return SF_ICON_COLORS[name] ?? '#5867E8'
}
