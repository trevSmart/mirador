import type { IDockviewPanelProps } from 'dockview'
import { PlaceholderPanel } from './PlaceholderPanel'

export function AgentsPanel(props: IDockviewPanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      description="Llista d'agents Omni. El contingut s'afegirà en una iteració posterior."
    />
  )
}
