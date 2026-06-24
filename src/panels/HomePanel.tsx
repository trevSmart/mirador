import { useCallback, useMemo, useRef, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { useAuth } from '../auth/auth-context'
import { AgentRow } from '../components/AgentRow'
import { SfIcon, FadeValue } from '../components/ds'
import { InsightsBanner } from '../components/InsightsBanner'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { FloorPanel } from './FloorPanel'
import { useFloorSeatedAgentIds } from '../floor/floor-seated-agents'
import { addPanelByType } from './panel-actions'
import type { PanelType } from './registry'
import { computeHealthInsights } from '../utils/health-insights'

const SPLIT_KEY = 'mirador.home.split'
const MIN_SPLIT = 0.25
const MAX_SPLIT = 0.75

/** Left-column fraction (0..1) persisted between sessions. */
function loadSplit(): number {
  try {
    const raw = localStorage.getItem(SPLIT_KEY)
    if (raw) {
      const value = Number.parseFloat(raw)
      if (Number.isFinite(value)) return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value))
    }
  } catch {
    /* ignore */
  }
  return 0.62
}
import {
  countAgentsByStatus,
  pickRepresentativeAgents,
  sortQueuesByBacklog,
  totalAgentWork,
  totalQueueBacklog,
} from '../utils/agent-stats'

export function HomePanel({ containerApi }: IDockviewPanelProps) {
  const { agents, queues } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
  const { isMockMode } = useAuth()
  const statusCounts = countAgentsByStatus(agents)
  const topQueues = sortQueuesByBacklog(queues).slice(0, 5)

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

  const layoutRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<number>(loadSplit)
  const seatedAgentIds = useFloorSeatedAgentIds()

  const activeAgents = useMemo(() => {
    const seated =
      seatedAgentIds.size > 0
        ? agents.filter((agent) => seatedAgentIds.has(agent.id))
        : agents
    return pickRepresentativeAgents(seated, 5)
  }, [agents, seatedAgentIds])

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    const layout = layoutRef.current
    if (!layout) return

    const onMove = (move: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const fraction = (move.clientX - rect.left) / rect.width
      setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSplit((current) => {
        try {
          localStorage.setItem(SPLIT_KEY, String(current))
        } catch {
          /* ignore */
        }
        return current
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  // Single CSS var drives the left column; the right stays at 1fr, so the
  // ratio is split / (1 - split). The media query can still override cleanly.
  const layoutStyle = {
    ['--home-split']: `${split / (1 - split)}fr`,
  } as React.CSSProperties

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0 && queues.length === 0}
      emptyMessage="No hi ha agents ni cues disponibles."
      shellClassName="panel-shell--home"
    >
      <InsightsBanner health={health} queueCount={queues.length} onOpenPanel={handleOpenPanel} />

      <div className="summary-grid">
        <section className="summary-card">
          <div className="summary-card__body">
            <div className="summary-card__lead">
              <SfIcon
                className="summary-card__icon"
                sprite="standard"
                symbol="customers"
                sldsSize="small"
                bg="var(--pa-ic-user)"
              />
              <div className="summary-card__text">
                <p className="summary-card__label">Agents</p>
                <p className="summary-card__detail">
                  <FadeValue value={statusCounts.online} /> en línia ·{' '}
                  <FadeValue value={statusCounts.busy} /> ocupats ·{' '}
                  <FadeValue value={statusCounts.away} /> absents ·{' '}
                  <FadeValue value={statusCounts.offline} /> desconnectats
                </p>
              </div>
            </div>
            <FadeValue as="p" className="summary-card__value" value={agents.length} />
          </div>
        </section>

        <section className="summary-card">
          <div className="summary-card__body">
            <div className="summary-card__lead">
              <SfIcon
                className="summary-card__icon"
                name="work"
                sldsSize="small"
                bg="var(--pa-ic-work)"
              />
              <div className="summary-card__text">
                <p className="summary-card__label">Treball actiu</p>
                <p className="summary-card__detail">Casos assignats als agents</p>
              </div>
            </div>
            <FadeValue as="p" className="summary-card__value" value={totalAgentWork(agents)} />
          </div>
        </section>

        <section className="summary-card">
          <div className="summary-card__body">
            <div className="summary-card__lead">
              <SfIcon
                className="summary-card__icon"
                name="queue"
                sldsSize="small"
                bg="var(--pa-ic-queue)"
              />
              <div className="summary-card__text">
                <p className="summary-card__label">Cues</p>
                <p className="summary-card__detail">
                  <FadeValue value={totalQueueBacklog(queues)} /> treballs en cua
                </p>
              </div>
            </div>
            <FadeValue as="p" className="summary-card__value" value={queues.length} />
          </div>
        </section>
      </div>

      <div className="home-layout" ref={layoutRef} style={layoutStyle}>
        <section className="home-floor">
          <FloorPanel />
        </section>

        <div
          className="home-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajusta la proporció de les columnes"
          onPointerDown={startResize}
        >
          <span className="home-resizer__grip" aria-hidden="true" />
        </div>

        <div className="home-side">
          <section className="panel-section">
            <h3 className="panel-section__title">Cues amb més backlog</h3>
            {topQueues.length > 0 ? (
              <div className="entity-list entity-list--grid">
                {topQueues.map((queue) => (
                  <QueueRow key={queue.id} queue={queue} />
                ))}
              </div>
            ) : (
              <p className="panel-section__empty">Cap cua amb treball pendent.</p>
            )}
          </section>

          <section className="panel-section">
            <h3 className="panel-section__title">Agents al plànol</h3>
            {activeAgents.length > 0 ? (
              <div className="entity-list entity-list--grid">
                {activeAgents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <p className="panel-section__empty">Cap agent assignat al plànol.</p>
            )}
          </section>
        </div>
      </div>
    </PanelState>
  )
}
