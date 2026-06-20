import type { IDockviewPanelProps } from 'dockview'
import { PlaceholderPanel } from './PlaceholderPanel'

export function HomePanel(props: IDockviewPanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      description="Resum del supervisor. El contingut s'afegirà en una iteració posterior."
    />
  )
}
