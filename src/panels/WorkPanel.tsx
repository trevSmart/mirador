import { useMemo, useState, type ReactNode } from 'react'
import { useAgents, useDataStatus, useQueues, useWork } from '../api/data-hooks'
import { AgentAvatar } from '../components/AgentRow'
import { FadeValue, SfIcon } from '../components/ds'
import { AppIcon } from '../components/ds/AppIcon'
import { Select, type SelectOption } from '../components/ds/Select'
import { PanelState } from '../components/PanelState'
import { WorkRow } from '../components/WorkRow'
import { countWorkByStatus, groupWork, type WorkGroup, type WorkGroupBy } from '../utils/agent-stats'
import { colorFromRecordId } from '../utils/color-from-string'
import { channelLabel, formatSeconds, workStatusLabel } from '../utils/format'
import type { Agent, ChannelKey, WorkStatus } from '../api/types'

const GROUP_OPTIONS: SelectOption<WorkGroupBy>[] = [
  { value: 'queue', label: 'Agrupa per cua' },
  { value: 'agent', label: 'Agrupa per agent' },
  { value: 'channel', label: 'Agrupa per canal' },
  { value: 'status', label: 'Agrupa per estat' },
]

const GROUP_BY_STORAGE = 'mirador.work.groupBy'

/** Stable key for a group's collapse state (the fallback bucket has a null key). */
const UNGROUPED_KEY = '__ungrouped__'

/** Read the persisted grouping criterion, falling back when missing or unknown. */
function loadGroupBy(): WorkGroupBy {
  try {
    const raw = localStorage.getItem(GROUP_BY_STORAGE)
    if (raw && GROUP_OPTIONS.some((option) => option.value === raw)) {
      return raw as WorkGroupBy
    }
  } catch {
    /* ignore */
  }
  return 'queue'
}

interface GroupHeader {
  label: string
  icon: ReactNode
}

interface NameLookups {
  queueNames: Map<string, string>
  agentsById: Map<string, Agent>
}

/** Resolve the label + tinted icon shown in a group header for the active criterion. */
function resolveGroupHeader(group: WorkGroup, groupBy: WorkGroupBy, names: NameLookups): GroupHeader {
  const { key } = group
  switch (groupBy) {
    case 'queue':
      return {
        label: key ? (names.queueNames.get(key) ?? key) : 'Sense cua',
        icon: (
          <SfIcon
            className="panel-section__icon"
            name="queue"
            sldsSize="x-small"
            bg={key ? colorFromRecordId(key) : undefined}
          />
        ),
      }
    case 'agent': {
      const agent = key ? names.agentsById.get(key) : undefined
      return {
        label: agent?.name ?? (key ? key : 'Sense assignar'),
        icon: key ? (
          <span className="work-group__avatar">
            <AgentAvatar id={key} name={agent?.name ?? key} photo={agent?.photo ?? null} />
          </span>
        ) : (
          <SfIcon className="panel-section__icon" name="user" sldsSize="x-small" />
        ),
      }
    }
    case 'channel':
      return {
        label: key ? channelLabel(key as ChannelKey) : 'Sense canal',
        icon: key ? (
          <SfIcon className="panel-section__icon" channel={key as ChannelKey} sldsSize="x-small" />
        ) : (
          <SfIcon className="panel-section__icon" name="work" sldsSize="x-small" />
        ),
      }
    default:
      return {
        label: key ? workStatusLabel(key as WorkStatus) : 'Sense estat',
        icon: <SfIcon className="panel-section__icon" name="work" sldsSize="x-small" />,
      }
  }
}

export function WorkPanel() {
  const agents = useAgents()
  const queues = useQueues()
  const work = useWork()
  const { isLoading, error, refresh } = useDataStatus()
  const [groupBy, setGroupBy] = useState<WorkGroupBy>(loadGroupBy)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  // Groups mid-transition: their content keeps overflow hidden so it clips while
  // the grid grows/shrinks; once settled, expanded groups get overflow visible
  // again so card shadows and hover-lift aren't clipped (apex-log-viewer pattern).
  const [animating, setAnimating] = useState<Set<string>>(() => new Set())

  const handleGroupBy = (value: WorkGroupBy) => {
    setGroupBy(value)
    // Group keys differ across criteria, so start each criterion fully expanded.
    setCollapsed(new Set())
    setAnimating(new Set())
    try {
      localStorage.setItem(GROUP_BY_STORAGE, value)
    } catch {
      /* ignore */
    }
  }

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    setAnimating((prev) => new Set(prev).add(key))
  }

  const endAnimating = (key: string) => {
    setAnimating((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const groups = useMemo(() => groupWork(work, groupBy), [work, groupBy])
  const statusCounts = countWorkByStatus(work)

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  )
  const queueNames = useMemo(
    () => new Map(queues.map((queue) => [queue.id, queue.name])),
    [queues],
  )
  const names: NameLookups = { queueNames, agentsById }

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={work.length === 0}
      emptyMessage="No hi ha treball assignat ni en cua."
    >
      <p className="panel-summary">
        <FadeValue value={work.length} /> treballs · <FadeValue value={statusCounts.assigned} /> assignats ·{' '}
        <FadeValue value={statusCounts.queued} /> en cua
      </p>

      <div className="panel-section__filters" role="group" aria-label="Agrupa el treball">
        <Select
          className="panel-section__sort"
          ariaLabel="Agrupa el treball"
          value={groupBy}
          options={GROUP_OPTIONS}
          onChange={handleGroupBy}
        />
      </div>

      {groups.map((group) => {
        const header = resolveGroupHeader(group, groupBy, names)
        const groupKey = group.key ?? UNGROUPED_KEY
        const isCollapsed = collapsed.has(groupKey)
        const overflowVisible = !isCollapsed && !animating.has(groupKey)
        return (
          <section key={groupKey} className="panel-section work-group">
            <button
              type="button"
              className="panel-section__header work-group__toggle"
              aria-expanded={!isCollapsed}
              onClick={() => toggleCollapsed(groupKey)}
            >
              <div className="panel-section__heading">
                <AppIcon
                  name="chevronright"
                  size={12}
                  className={`work-group__chevron${isCollapsed ? '' : ' work-group__chevron--open'}`}
                />
                {header.icon}
                <h3 className="panel-section__title">{header.label}</h3>
              </div>
              <span className="work-group__count">
                <FadeValue value={group.items.length} /> treballs · més antic{' '}
                <FadeValue value={formatSeconds(group.oldestAgeSec)} />
              </span>
            </button>

            <div
              className={`work-group__expand${isCollapsed ? '' : ' is-open'}`}
              onTransitionEnd={(event) => {
                if (event.propertyName === 'grid-template-rows') endAnimating(groupKey)
              }}
            >
              <div
                className={`work-group__expand-inner${overflowVisible ? ' is-visible' : ''}`}
              >
                <div className="work-grid">
                  {group.items.map((item) => (
                    <WorkRow
                      key={item.id}
                      item={item}
                      agentName={item.agentId ? agentsById.get(item.agentId)?.name : null}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )
      })}
    </PanelState>
  )
}
