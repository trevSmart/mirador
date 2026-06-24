import { SfIcon, type SfIconSize } from '../components/ds/SfIcon'
import { getPanelDefinition, type PanelType } from './registry'

interface PanelIconProps {
  type: PanelType
  size?: number
  sldsSize?: SfIconSize
}

/** SLDS icon for a dockview panel type (tabs, headers, menus). */
export function PanelIcon({ type, size, sldsSize }: PanelIconProps) {
  const { icon } = getPanelDefinition(type)
  if ('name' in icon) {
    return <SfIcon name={icon.name} size={size} sldsSize={sldsSize} />
  }
  return <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={size} sldsSize={sldsSize} />
}
