import type { IDockviewPanelProps } from 'dockview-react'

interface PlaceholderPanelProps extends IDockviewPanelProps {
  description: string
}

export function PlaceholderPanel({ api, description }: PlaceholderPanelProps) {
  return (
    <div className="panel-shell">
      <h2 className="panel-shell__title">{api.title}</h2>
      <p className="panel-shell__description">{description}</p>
    </div>
  )
}
