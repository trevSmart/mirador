import { SfIcon } from '../components/ds'
import { getPanelDefinition, type PanelType } from './registry'

interface PanelIconProps {
  type: PanelType
  size?: number
}

/** SLDS icon for a dockview panel type (tabs, headers, menus). */
export function PanelIcon({ type, size = 24 }: PanelIconProps) {
  const { iconName } = getPanelDefinition(type)
  return <SfIcon name={iconName} size={size} />
}
