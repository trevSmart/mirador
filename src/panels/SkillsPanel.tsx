import type { IDockviewPanelProps } from 'dockview'
import { PlaceholderPanel } from './PlaceholderPanel'

export function SkillsPanel(props: IDockviewPanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      description="Catàleg de skills. El contingut s'afegirà en una iteració posterior."
    />
  )
}
