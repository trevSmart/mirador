import type { IDockviewPanelProps } from 'dockview'
import { PlaceholderPanel } from './PlaceholderPanel'

export function WorkPanel(props: IDockviewPanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      description="Treball assignat i en cua. El contingut s'afegirà en una iteració posterior."
    />
  )
}
