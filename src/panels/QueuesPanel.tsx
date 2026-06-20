import type { IDockviewPanelProps } from 'dockview'
import { PlaceholderPanel } from './PlaceholderPanel'

export function QueuesPanel(props: IDockviewPanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      description="Mètriques de cues. El contingut s'afegirà en una iteració posterior."
    />
  )
}
