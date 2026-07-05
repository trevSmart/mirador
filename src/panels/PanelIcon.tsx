import { AppIcon } from '../components/ds/AppIcon'
import { SfIcon, type SfIconSize } from '../components/ds/SfIcon'
import { getPanelDefinition, type PanelType } from './registry'

/** Mides SLDS nominals → píxels, per a les icones AppIcon del registre. */
const SLDS_SIZE_PX: Record<SfIconSize, number> = {
  'xx-small': 14,
  'x-small': 16,
  small: 24,
  medium: 32,
  large: 48,
}

interface PanelIconProps {
  type: PanelType
  size?: number
  sldsSize?: SfIconSize
}

/** Icon for a dockview panel type (tabs, headers, menus). */
export function PanelIcon({ type, size, sldsSize }: PanelIconProps) {
  const { icon } = getPanelDefinition(type)
  if ('app' in icon) {
    return <AppIcon name={icon.app} size={size ?? SLDS_SIZE_PX[sldsSize ?? 'medium']} />
  }
  if ('name' in icon) {
    return <SfIcon name={icon.name} size={size} sldsSize={sldsSize} />
  }
  return <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={size} sldsSize={sldsSize} />
}
