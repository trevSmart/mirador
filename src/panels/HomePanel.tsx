import type { IDockviewPanelProps } from 'dockview-react'
import { useCallback, useRef, useState } from 'react'
import { useMiradorData } from '../api/mirador-data-context'
import { AgentRow } from '../components/AgentRow'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { FloorPanel } from './FloorPanel'

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
  sortAgentsByPresence,
  sortQueuesByBacklog,
  totalAgentWork,
  totalQueueBacklog,
} from '../utils/agent-stats'

export function HomePanel({ api }: IDockviewPanelProps) {
  const { agents, queues, isLoading, error, refresh } = useMiradorData()
  const statusCounts = countAgentsByStatus(agents)
  const topQueues = sortQueuesByBacklog(queues).slice(0, 5)
  const activeAgents = sortAgentsByPresence(agents).slice(0, 5)

  const layoutRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<number>(loadSplit)

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
      panelType="home"
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0 && queues.length === 0}
      emptyMessage="No hi ha agents ni cues disponibles."
    >
      <div className="summary-grid">
        <section className="summary-card">
          <p className="summary-card__label">Agents</p>
          <p className="summary-card__value">{agents.length}</p>
          <p className="summary-card__detail">
            {statusCounts.online} en línia · {statusCounts.busy} ocupats ·{' '}
            {statusCounts.away} absents · {statusCounts.offline} fora de línia
          </p>
        </section>

        <section className="summary-card">
          <p className="summary-card__label">Treball actiu</p>
          <p className="summary-card__value">{totalAgentWork(agents)}</p>
          <p className="summary-card__detail">Casos assignats als agents</p>
        </section>

        <section className="summary-card">
          <p className="summary-card__label">Cues</p>
          <p className="summary-card__value">{queues.length}</p>
          <p className="summary-card__detail">{totalQueueBacklog(queues)} treballs en cua</p>
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
              <div className="entity-list">
                {topQueues.map((queue) => (
                  <QueueRow key={queue.id} queue={queue} />
                ))}
              </div>
            ) : (
              <p className="panel-section__empty">Cap cua amb treball pendent.</p>
            )}
          </section>

          <section className="panel-section">
            <h3 className="panel-section__title">Agents actius</h3>
            {activeAgents.length > 0 ? (
              <div className="entity-list">
                {activeAgents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <p className="panel-section__empty">Cap agent connectat ara mateix.</p>
            )}
          </section>
        </div>
      </div>
    </PanelState>
  )
}
