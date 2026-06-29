import { useCallback, useMemo, useRef, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useAgents, useDataStatus, usePresenceStatuses, useQueues } from '../api/data-hooks'
import { AgentRow } from '../components/AgentRow'
import { SfIcon, Chip } from '../components/ds'
import { Select, type SelectOption } from '../components/ds/Select'
import { InsightsBanner } from '../components/InsightsBanner'
import { PanelState } from '../components/PanelState'
import { QueueRow } from '../components/QueueRow'
import { SpacePanel } from './SpacePanel'
import { addPanelByType } from './panel-actions'
import type { PanelType } from './registry'
import { computeHealthInsights } from '../utils/health-insights'
import { useGridAutoAnimate } from '../utils/home-grid-reorder'
import { useSmoothScroll } from '../hooks/useSmoothScroll'

const SPLIT_KEY = 'mirador.home.split'
const MIN_SPLIT = 0.25
const MAX_SPLIT = 0.75
const DEFAULT_SPLIT = 0.62

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
  return DEFAULT_SPLIT
}
import {
  sortAgents,
  sortQueues,
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
/**
 * Agent filter on Home: the CONNECTED_FILTER sentinel (everyone with an active
 * Omni-Channel presence) or a specific real presence status id. Offline agents
 * are never shown on Home — use the Agents panel for the full roster.
 */
type AgentFilter = string

const CONNECTED_FILTER = 'connected'

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
  const agents = useAgents()
  const queues = useQueues()
  const presenceStatuses = usePresenceStatuses()
  const { isLoading, error, refresh } = useDataStatus()

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
  const [agentFilter, setAgentFilter] = useState<AgentFilter>(CONNECTED_FILTER)

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

  const health = useMemo(() => computeHealthInsights(agents, queues), [agents, queues])

  const handleOpenPanel = (panel: PanelType) => {
    addPanelByType(containerApi, panel)
  }

  const layoutRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<number>(loadSplit)
  const attachQueueGrid = useGridAutoAnimate<HTMLDivElement>()
  const attachAgentGrid = useGridAutoAnimate<HTMLDivElement>()
  // The right column is the only scroll container on Home (the shell is
  // overflow:hidden), so it needs Lenis to match the smooth scroll the rest of
  // the app gets via PanelShell.
  const attachSideScroll = useSmoothScroll<HTMLDivElement>()

  // Home shows only agents connected to Omni-Channel — i.e. those with an active
  // presence (a presence status id), no matter what that status is named. Agents
  // with no presence at all live in the Agents panel. We deliberately do NOT
  // judge connection by the status name/category (no keyword heuristics).
  const connectedAgents = useMemo(
    () => agents.filter((agent) => agent.presenceStatusId !== null),
    [agents],
  )

  // One filter chip per presence status configured in the org (the full
  // catalog, every status, unfiltered), with a live count computed over the
  // connected agents. Chips stay visible even at count 0.
  const presenceFilters = useMemo(() => {
    const countById = new Map<string, number>()
    for (const agent of connectedAgents) {
      const id = agent.presenceStatusId
      if (id) countById.set(id, (countById.get(id) ?? 0) + 1)
    }
    return presenceStatuses.map((status) => ({
      id: status.id,
      label: status.label,
      count: countById.get(status.id) ?? 0,
    }))
  }, [presenceStatuses, connectedAgents])

  // "connected" always exists; a selected status id is always a real chip from
  // the catalog, so no fallback is needed here.
  const effectiveFilter = agentFilter

  const activeAgents = useMemo(() => {
    const filtered =
      effectiveFilter === CONNECTED_FILTER
        ? connectedAgents
        : connectedAgents.filter((agent) => agent.presenceStatusId === effectiveFilter)
    return sortAgents(filtered, agentSort).slice(0, 5)
  }, [connectedAgents, effectiveFilter, agentSort])

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    const layout = layoutRef.current
    if (!layout) return

    // Drive the drag straight through the DOM: writing the CSS var and the
    // `is-resizing` class avoids re-rendering the (heavy) space view on every
    // pointermove. React state is only synced once, on release.
    let latest = split
    let frame = 0
    layout.classList.add('is-resizing')
    // Coalesce pointermove bursts to one DOM write per frame: pointermove can
    // fire several times between paints, so we only apply the latest value.
    const flush = () => {
      frame = 0
      layout.style.setProperty('--home-split', `${latest / (1 - latest)}fr`)
    }
    const onMove = (move: PointerEvent) => {
      const rect = layout.getBoundingClientRect()
      const fraction = (move.clientX - rect.left) / rect.width
      latest = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction))
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (frame) cancelAnimationFrame(frame)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      layout.classList.remove('is-resizing')
      setSplit(latest)
      try {
        localStorage.setItem(SPLIT_KEY, String(latest))
      } catch {
        /* ignore */
      }
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [split])

  // Double-clicking the divider restores the default column proportions.
  const resetSplit = useCallback(() => {
    setSplit(DEFAULT_SPLIT)
    try {
      localStorage.setItem(SPLIT_KEY, String(DEFAULT_SPLIT))
    } catch {
      /* ignore */
    }
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

      <div className="home-layout" ref={layoutRef} style={layoutStyle}>
        <section className="home-space">
          <SpacePanel />
        </section>

        <div
          className="home-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajusta la proporció de les columnes (doble clic per restablir)"
          onPointerDown={startResize}
          onDoubleClick={resetSplit}
        >
          <span className="home-resizer__grip" aria-hidden="true" />
        </div>

        <div className="home-side" ref={attachSideScroll}>
          <section className="panel-section">
            <header className="panel-section__header">
              <div className="panel-section__heading">
                <SfIcon
                  className="panel-section__icon"
                  name="queue"
                  sldsSize="x-small"
                />
                <h3 className="panel-section__title">Queues</h3>
              </div>
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
              <Select
                className="panel-section__sort"
                ariaLabel="Ordena les cues"
                value={queueSort}
                options={QUEUE_SORT_OPTIONS}
                onChange={handleQueueSort}
              />
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
                />
                <h3 className="panel-section__title">Agents</h3>
              </div>
            </header>
            <div className="panel-section__filters" role="group" aria-label="Filtra els agents">
              <Chip
                active={effectiveFilter === CONNECTED_FILTER}
                count={connectedAgents.length}
                onClick={() => setAgentFilter(CONNECTED_FILTER)}
              >
                Connectats
              </Chip>
              {presenceFilters.map((filter) => (
                // No status dot: Salesforce doesn't expose whether a presence
                // status is "busy" via any API, so we don't imply a meaning we
                // can't back up.
                <Chip
                  key={filter.id}
                  active={effectiveFilter === filter.id}
                  count={filter.count}
                  onClick={() => setAgentFilter(filter.id)}
                >
                  {filter.label}
                </Chip>
              ))}
              <Select
                className="panel-section__sort"
                ariaLabel="Ordena els agents"
                value={agentSort}
                options={AGENT_SORT_OPTIONS}
                onChange={handleAgentSort}
              />
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
