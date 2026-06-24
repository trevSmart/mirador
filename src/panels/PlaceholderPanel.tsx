import type { IDockviewPanelProps } from 'dockview-react'

interface PlaceholderPanelProps extends IDockviewPanelProps {
  description: string
}

export function PlaceholderPanel({ description }: PlaceholderPanelProps) {
  return (
    <div className="panel-shell">
      <p className="panel-shell__description">{description}</p>
    </div>
  )
}
