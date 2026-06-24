import { useMemo } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useMiradorData } from '../api/mirador-data-context'
import { useAuth } from '../auth/auth-context'
import { InsightsBanner } from '../components/InsightsBanner'
import { PanelState } from '../components/PanelState'
import { computeHealthInsights } from '../utils/health-insights'
import { addPanelByType } from './panel-actions'
import type { PanelType } from './registry'

export function InsightsPanel({ api, containerApi }: IDockviewPanelProps) {
  const { agents, queues, isLoading, error, refresh } = useMiradorData()
  const { isMockMode } = useAuth()

  const health = useMemo(
    () =>
      computeHealthInsights(agents, queues, {
        includeExtendedMetrics: isMockMode,
      }),
    [agents, isMockMode, queues],
  )

  const handleOpenPanel = (panel: PanelType) => {
    addPanelByType(containerApi, panel)
  }

  return (
    <PanelState
      panelType="insights"
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0 && queues.length === 0}
      emptyMessage="No hi ha dades operatives per mostrar."
      hideHeader
      shellClassName="panel-shell--insights"
    >
      <InsightsBanner health={health} queueCount={queues.length} onOpenPanel={handleOpenPanel} />
    </PanelState>
  )
}
