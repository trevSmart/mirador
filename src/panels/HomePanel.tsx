import { useCallback, useMemo, useRef, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { useAuth } from '../auth/auth-context'
import { AgentRow } from '../components/AgentRow'
import { SfIcon, FadeValue, Chip } from '../components/ds'
import { Select, type SelectOption } from '../components/ds/Select'
import { presenceLabel } from '../utils/format'
import type { PresenceStatus } from '../api/types'
import { InsightsBanner } from '../components/InsightsBanner'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { FloorPanel } from './FloorPanel'
import { useFloorSeatedAgentIds } from '../floor/floor-seated-agents'
import { addPanelByType } from './panel-actions'
import type { PanelType } from './registry'
import { computeHealthInsights } from '../utils/health-insights'
import { useGridAutoAnimate } from '../utils/home-grid-reorder'

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
  sortAgents,
  sortQueues,
  totalAgentWork,
  totalQueueBacklog,
  type AgentSortKey,
  type QueueSortKey,
} from '../utils/agent-stats'

const QUEUE_SORT_STORAGE = 'mirador.home.queueSort'
const AGENT_SORT_STORAGE = 'mirador.home.agentSort'

const QUEUE_SORT_OPTIONS: SelectOption<QueueSortKey>[] = [
  { value: 'backlog', label: 'Més backlog' },
  { value: 'longest', label: 'Espera màxima' },
  { value: 'avg', label: 'Espera mitjana' },
  { value: 'online', label: 'Agents en línia' },
  { value: 'name', label: 'Nom' },
]

const AGENT_SORT_OPTIONS: SelectOption<AgentSortKey>[] = [
  { value: 'presence', label: 'Presència' },
  { value: 'work', label: 'Treball actiu' },
  { value: 'capacity', label: 'Capacitat lliure' },
  { value: 'name', label: 'Nom' },
]

type QueueFilter = 'all' | 'backlog' | 'idle'
type AgentFilter = 'all' | PresenceStatus

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const AGENT_FILTERS: AgentFilter[] = ['all', 'online', 'busy', 'away', 'offline']

/** Read a persisted sort key, falling back when missing or unknown. */
function loadSort<T extends string>(storageKey: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw && (allowed as readonly string[]).includes(raw)) return raw as T
  } catch {
    /* ignore */
  }
  return fallback
}

export function HomePanel({ containerApi }: IDockviewPanelProps) {
  const { agents, queues } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
  const { isMockMode } = useAuth()
  const statusCounts = countAgentsByStatus(agents)

  const [queueSort, setQueueSort] = useState<QueueSortKey>(() =>
    loadSort(
      QUEUE_SORT_STORAGE,
      QUEUE_SORT_OPTIONS.map((option) => option.value),
      'backlog',
    ),
  )
  const [agentSort, setAgentSort] = useState<AgentSortKey>(() =>
    loadSort(
      AGENT_SORT_STORAGE,
      AGENT_SORT_OPTIONS.map((option) => option.value),
      'presence',
    ),
  )

  const handleQueueSort = (value: QueueSortKey) => {
    setQueueSort(value)
    try {
      localStorage.setItem(QUEUE_SORT_STORAGE, value)
    } catch {
      /* ignore */
    }
  }
  const handleAgentSort = (value: AgentSortKey) => {
    setAgentSort(value)
    try {
      localStorage.setItem(AGENT_SORT_STORAGE, value)
    } catch {
      /* ignore */
    }
  }

  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all')

  const queueFilterCounts = useMemo(
    () => ({
      all: queues.length,
      backlog: queues.filter((queue) => queue.backlog > 0).length,
      idle: queues.filter((queue) => queue.online === 0).length,
    }),
    [queues],
  )

  const topQueues = useMemo(() => {
    const filtered = queues.filter((queue) => {
      if (queueFilter === 'backlog') return queue.backlog > 0
      if (queueFilter === 'idle') return queue.online === 0
      return true
    })
    return sortQueues(filtered, queueSort).slice(0, 5)
  }, [queues, queueFilter, queueSort])

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
  const attachQueueGrid = useGridAutoAnimate<HTMLDivElement>()
  const attachAgentGrid = useGridAutoAnimate<HTMLDivElement>()

  const seatedAgents = useMemo(
    () =>
      seatedAgentIds.size > 0
        ? agents.filter((agent) => seatedAgentIds.has(agent.id))
        : agents,
    [agents, seatedAgentIds],
  )

  const agentFilterCounts = useMemo(() => countAgentsByStatus(seatedAgents), [seatedAgents])

  const activeAgents = useMemo(() => {
    const filtered =
      agentFilter === 'all'
        ? seatedAgents
        : seatedAgents.filter((agent) => agent.status === agentFilter)
    return sortAgents(filtered, agentSort).slice(0, 5)
  }, [seatedAgents, agentFilter, agentSort])

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
            <header className="panel-section__header">
              <div className="panel-section__heading">
                <SfIcon
                  className="panel-section__icon"
                  name="queue"
                  sldsSize="x-small"
                  bg="var(--pa-ic-queue)"
                />
                <h3 className="panel-section__title">Queues</h3>
              </div>
              <Select
                className="panel-section__sort"
                ariaLabel="Ordena les cues"
                value={queueSort}
                options={QUEUE_SORT_OPTIONS}
                onChange={handleQueueSort}
              />
            </header>
            <div className="panel-section__filters" role="group" aria-label="Filtra les cues">
              <Chip
                active={queueFilter === 'all'}
                count={queueFilterCounts.all}
                onClick={() => setQueueFilter('all')}
              >
                Totes
              </Chip>
              <Chip
                active={queueFilter === 'backlog'}
                count={queueFilterCounts.backlog}
                onClick={() => setQueueFilter('backlog')}
              >
                Amb backlog
              </Chip>
              <Chip
                active={queueFilter === 'idle'}
                count={queueFilterCounts.idle}
                onClick={() => setQueueFilter('idle')}
              >
                Sense agents
              </Chip>
            </div>
            {topQueues.length > 0 ? (
              <div className="entity-list entity-list--grid" ref={attachQueueGrid}>
                {topQueues.map((queue) => (
                  <QueueRow key={queue.id} queue={queue} />
                ))}
              </div>
            ) : (
              <p className="panel-section__empty">Cap cua amb treball pendent.</p>
            )}
          </section>

          <section className="panel-section">
            <header className="panel-section__header">
              <div className="panel-section__heading">
                <SfIcon
                  className="panel-section__icon"
                  sprite="standard"
                  symbol="customers"
                  sldsSize="x-small"
                  bg="var(--pa-ic-user)"
                />
                <h3 className="panel-section__title">Agents</h3>
              </div>
              <Select
                className="panel-section__sort"
                ariaLabel="Ordena els agents"
                value={agentSort}
                options={AGENT_SORT_OPTIONS}
                onChange={handleAgentSort}
              />
            </header>
            <div className="panel-section__filters" role="group" aria-label="Filtra els agents">
              {AGENT_FILTERS.map((filter) => (
                <Chip
                  key={filter}
                  active={agentFilter === filter}
                  dotColor={filter === 'all' ? undefined : PRESENCE_DOT[filter]}
                  count={filter === 'all' ? seatedAgents.length : agentFilterCounts[filter]}
                  onClick={() => setAgentFilter(filter)}
                >
                  {filter === 'all' ? 'Tots' : presenceLabel(filter)}
                </Chip>
              ))}
            </div>
            {activeAgents.length > 0 ? (
              <div className="entity-list entity-list--grid" ref={attachAgentGrid}>
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
