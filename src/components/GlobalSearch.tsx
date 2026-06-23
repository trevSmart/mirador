import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react'
import { useMiradorData } from '../api/mirador-data-context'
import type { Agent, PresenceStatus, Queue, Skill } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { colorFromString } from '../utils/color-from-string'
import {
  getDetailRecents,
  setDetailRecentResolver,
  type DetailRecentEntry,
} from '../utils/detail-recent-store'
import {
  flattenSearchResults,
  runGlobalSearch,
  type SearchItemRef,
  type SearchWorkHit,
} from '../utils/global-search'
import { presenceLabel } from '../utils/format'
import { syncDropdownPanel } from '../utils/sync-dropdown-panel'
import { AgentAvatar } from './AgentRow'
import { SfIcon } from './ds/SfIcon'

const CONTENT_TRANSITION_MS = 220

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4-4" />
    </svg>
  )
}

interface SearchAgentItemProps {
  agent: Pick<Agent, 'id' | 'name' | 'role' | 'status' | 'photo'>
  active: boolean
  onSelect: () => void
}

function SearchAgentItem({ agent, active, onSelect }: SearchAgentItemProps) {
  const statusColor = PRESENCE_COLOR[agent.status]
  return (
    <button
      type="button"
      className={`qsearch-item${active ? ' on' : ''}`}
      role="option"
      aria-selected={active}
      onClick={onSelect}
    >
      <span className="si-av">
        <AgentAvatar name={agent.name} photo={agent.photo} />
      </span>
      <span className="si-main">
        <div className="si-title">{agent.name}</div>
        <div className="si-meta">{agent.role}</div>
      </span>
      <span
        className="si-badge"
        style={{
          color: statusColor,
          background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
        }}
      >
        {presenceLabel(agent.status)}
      </span>
    </button>
  )
}

interface SearchQueueItemProps {
  queue: Pick<Queue, 'id' | 'name' | 'backlog' | 'online'>
  active: boolean
  onSelect: () => void
}

function SearchQueueItem({ queue, active, onSelect }: SearchQueueItemProps) {
  return (
    <button
      type="button"
      className={`qsearch-item${active ? ' on' : ''}`}
      role="option"
      aria-selected={active}
      onClick={onSelect}
    >
      <SfIcon name="queue" size={30} bg={colorFromString(queue.name)} radius={8} />
      <span className="si-main">
        <div className="si-title">{queue.name}</div>
        <div className="si-meta">
          {queue.backlog} backlog · {queue.online} online
        </div>
      </span>
      <span className="si-kbd">Queue</span>
    </button>
  )
}

interface SearchSkillItemProps {
  skill: Pick<Skill, 'id' | 'name' | 'agents'>
  active: boolean
  onSelect: () => void
}

function SearchSkillItem({ skill, active, onSelect }: SearchSkillItemProps) {
  return (
    <button
      type="button"
      className={`qsearch-item${active ? ' on' : ''}`}
      role="option"
      aria-selected={active}
      onClick={onSelect}
    >
      <SfIcon name="skill" size={30} radius={8} />
      <span className="si-main">
        <div className="si-title">{skill.name}</div>
        <div className="si-meta">{skill.agents} qualified agents</div>
      </span>
      <span className="si-kbd">Skill</span>
    </button>
  )
}

interface SearchWorkItemProps {
  work: SearchWorkHit
  active: boolean
  onSelect: () => void
}

function SearchWorkItemRow({ work, active, onSelect }: SearchWorkItemProps) {
  return (
    <button
      type="button"
      className={`qsearch-item${active ? ' on' : ''}`}
      role="option"
      aria-selected={active}
      onClick={onSelect}
    >
      <SfIcon channel={work.channelKey} size={30} radius={8} />
      <span className="si-main">
        <div className="si-title">{work.title}</div>
        <div className="si-meta">
          {work.agentName}
          {work.meta ? ` · ${work.meta}` : ''}
        </div>
      </span>
      <span className="si-kbd">Work</span>
    </button>
  )
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="qsearch-group">
      <div className="qsearch-group-lbl">{label}</div>
      {children}
    </div>
  )
}

function resolveRecentEntry(
  entry: DetailRecentEntry,
  agents: Agent[],
  queues: Queue[],
  skills: Skill[],
): DetailRecentEntry {
  if (entry.kind === 'agent') {
    const agent = agents.find((item) => item.id === entry.id)
    if (agent) {
      return { ...entry, title: agent.name, meta: agent.role, status: agent.status }
    }
  }
  if (entry.kind === 'queue') {
    const queue = queues.find((item) => item.id === entry.id)
    if (queue) {
      return {
        ...entry,
        title: queue.name,
        meta: `${queue.backlog} backlog · ${queue.online} online`,
        backlog: queue.backlog,
        online: queue.online,
      }
    }
  }
  if (entry.kind === 'skill') {
    const skill = skills.find((item) => item.id === entry.id)
    if (skill) {
      return {
        ...entry,
        title: skill.name,
        meta: `${skill.agents} qualified agents`,
        agents: skill.agents,
      }
    }
  }
  return entry
}

export function GlobalSearch() {
  const { agents, queues, skills } = useMiradorData()
  const { openAgent, openQueue, openSkill } = useDetailDrawer()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [recentsVersion, setRecentsVersion] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const searchResults = useMemo(
    () => runGlobalSearch(normalizedQuery, agents, queues, skills),
    [agents, normalizedQuery, queues, skills],
  )

  const items: SearchItemRef[] = useMemo(() => {
    if (normalizedQuery) {
      return flattenSearchResults(searchResults)
    }
    // recentsVersion is the cache-bust key: re-read the (external) recents store
    // whenever a detail is opened.
    void recentsVersion
    const recents = getDetailRecents()
    return recents.map((entry) => ({ kind: entry.kind, id: entry.id }))
  }, [normalizedQuery, recentsVersion, searchResults])

  const syncAnimation = useCallback(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  useEffect(() => {
    syncAnimation()
  }, [open, syncAnimation])

  useEffect(() => {
    setDetailRecentResolver(({ kind, id }) => {
      if (kind === 'agent') {
        const agent = agents.find((item) => item.id === id)
        if (!agent) return null
        return { kind: 'agent', id, title: agent.name, meta: agent.role, status: agent.status }
      }
      if (kind === 'queue') {
        const queue = queues.find((item) => item.id === id)
        if (!queue) return null
        return {
          kind: 'queue',
          id,
          title: queue.name,
          meta: `${queue.backlog} backlog · ${queue.online} online`,
          backlog: queue.backlog,
          online: queue.online,
        }
      }
      if (kind === 'skill') {
        const skill = skills.find((item) => item.id === id)
        if (!skill) return null
        return {
          kind: 'skill',
          id,
          title: skill.name,
          meta: `${skill.agents} qualified agents`,
          agents: skill.agents,
        }
      }
      return null
    })
    return () => setDetailRecentResolver(null)
  }, [agents, queues, skills])

  const maxBodyHeight = useCallback(() => {
    if (!bodyRef.current) return 0
    const max = parseFloat(getComputedStyle(bodyRef.current).maxHeight)
    return Number.isFinite(max) ? max : bodyRef.current.scrollHeight
  }, [])

  const syncContentHeight = useCallback(
    (prevHeight: number) => {
      if (!bodyRef.current || !contentRef.current) return

      clearTimeout(heightTimerRef.current ?? undefined)
      const cap = maxBodyHeight()
      const nextHeight = Math.min(contentRef.current.scrollHeight, cap)
      const canAnimate =
        open &&
        dropRef.current?.classList.contains('is-open') &&
        prevHeight > 0 &&
        prevHeight !== nextHeight &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches

      bodyRef.current.classList.remove('has-scroll')
      bodyRef.current.style.transition = ''
      bodyRef.current.style.height = ''

      if (!canAnimate) {
        bodyRef.current.classList.toggle('has-scroll', contentRef.current.scrollHeight > cap)
        return
      }

      bodyRef.current.style.height = `${prevHeight}px`
      void bodyRef.current.offsetHeight
      bodyRef.current.style.transition = `height ${CONTENT_TRANSITION_MS}ms ease`
      bodyRef.current.style.height = `${nextHeight}px`
      heightTimerRef.current = setTimeout(() => {
        if (!bodyRef.current || !contentRef.current) return
        bodyRef.current.style.height = ''
        bodyRef.current.style.transition = ''
        bodyRef.current.classList.toggle('has-scroll', contentRef.current.scrollHeight > cap)
      }, CONTENT_TRANSITION_MS)
    },
    [maxBodyHeight, open],
  )

  useEffect(() => {
    if (!open) return
    const prevHeight = bodyRef.current?.offsetHeight ?? 0
    syncContentHeight(prevHeight)
  }, [open, normalizedQuery, recentsVersion, searchResults, activeIdx, syncContentHeight])

  const closePanel = useCallback((clear = false) => {
    clearTimeout(blurTimerRef.current ?? undefined)
    clearTimeout(heightTimerRef.current ?? undefined)
    if (bodyRef.current) {
      bodyRef.current.style.height = ''
      bodyRef.current.style.transition = ''
      bodyRef.current.classList.remove('has-scroll')
    }
    setOpen(false)
    setActiveIdx(-1)
    inputRef.current?.setAttribute('aria-expanded', 'false')
    if (clear) {
      setQuery('')
      inputRef.current?.blur()
    }
  }, [])

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        closePanel(true)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closePanel, open])

  const openPanel = useCallback(() => {
    clearTimeout(blurTimerRef.current ?? undefined)
    setOpen(true)
    inputRef.current?.setAttribute('aria-expanded', 'true')
  }, [])

  const handleSelect = useCallback(
    (kind: SearchItemRef['kind'], id: string) => {
      if (kind === 'agent') {
        openAgent(id)
      } else if (kind === 'work') {
        if (agents.some((item) => item.id === id)) openAgent(id)
      } else if (kind === 'queue') {
        openQueue(id)
      } else if (kind === 'skill') {
        openSkill(id)
      }
      setRecentsVersion((value) => value + 1)
      closePanel(true)
    },
    [agents, closePanel, openAgent, openQueue, openSkill],
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIdx((value) => Math.min(value + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIdx((value) => Math.max(value - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const idx = activeIdx >= 0 ? activeIdx : 0
      const item = items[idx]
      if (item) handleSelect(item.kind, item.id)
    }
  }

  useEffect(() => {
    if (!open) return
    const activeEl = dropRef.current?.querySelector('.qsearch-item.on')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  const handleDropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.qsearch-item')) {
      event.preventDefault()
    }
  }

  let content: React.ReactNode
  let idx = 0

  if (!normalizedQuery) {
    const recents = getDetailRecents()
    if (!recents.length) {
      content = (
        <div className="qsearch-hint">
          Search agents, queues, skills, and work items.
          <br />
          Your current view stays unchanged.
        </div>
      )
    } else {
      const recentAgents = recents.filter((entry) => entry.kind === 'agent')
      const recentQueues = recents.filter((entry) => entry.kind === 'queue')
      const recentSkills = recents.filter((entry) => entry.kind === 'skill')

      content = (
        <>
          {recentAgents.length ? (
            <SearchGroup label="Agents">
              {recentAgents.map((entry) => {
                const resolved = resolveRecentEntry(entry, agents, queues, skills)
                const currentIdx = idx++
                return (
                  <SearchAgentItem
                    key={`${entry.kind}:${entry.id}`}
                    agent={{
                      id: resolved.id,
                      name: resolved.title,
                      role: resolved.meta,
                      status: resolved.status ?? 'offline',
                      photo: agents.find((agent) => agent.id === resolved.id)?.photo ?? null,
                    }}
                    active={activeIdx === currentIdx}
                    onSelect={() => handleSelect('agent', resolved.id)}
                  />
                )
              })}
            </SearchGroup>
          ) : null}
          {recentQueues.length ? (
            <SearchGroup label="Queues">
              {recentQueues.map((entry) => {
                const resolved = resolveRecentEntry(entry, agents, queues, skills)
                const currentIdx = idx++
                return (
                  <SearchQueueItem
                    key={`${entry.kind}:${entry.id}`}
                    queue={{
                      id: resolved.id,
                      name: resolved.title,
                      backlog: resolved.backlog ?? 0,
                      online: resolved.online ?? 0,
                    }}
                    active={activeIdx === currentIdx}
                    onSelect={() => handleSelect('queue', resolved.id)}
                  />
                )
              })}
            </SearchGroup>
          ) : null}
          {recentSkills.length ? (
            <SearchGroup label="Skills">
              {recentSkills.map((entry) => {
                const resolved = resolveRecentEntry(entry, agents, queues, skills)
                const currentIdx = idx++
                return (
                  <SearchSkillItem
                    key={`${entry.kind}:${entry.id}`}
                    skill={{
                      id: resolved.id,
                      name: resolved.title,
                      agents: resolved.agents ?? 0,
                    }}
                    active={activeIdx === currentIdx}
                    onSelect={() => handleSelect('skill', resolved.id)}
                  />
                )
              })}
            </SearchGroup>
          ) : null}
        </>
      )
    }
  } else if (!items.length) {
    content = (
      <div className="qsearch-empty">
        No results for &quot;<b>{query.trim()}</b>&quot;
      </div>
    )
  } else {
    content = (
      <>
        {searchResults.agents.length ? (
          <SearchGroup label="Agents">
            {searchResults.agents.map((agent) => {
              const currentIdx = idx++
              return (
                <SearchAgentItem
                  key={agent.id}
                  agent={agent}
                  active={activeIdx === currentIdx}
                  onSelect={() => handleSelect('agent', agent.id)}
                />
              )
            })}
          </SearchGroup>
        ) : null}
        {searchResults.workItems.length ? (
          <SearchGroup label="Work">
            {searchResults.workItems.map((work) => {
              const currentIdx = idx++
              return (
                <SearchWorkItemRow
                  key={`${work.agentId}:${work.title}:${currentIdx}`}
                  work={work}
                  active={activeIdx === currentIdx}
                  onSelect={() => handleSelect('work', work.agentId)}
                />
              )
            })}
          </SearchGroup>
        ) : null}
        {searchResults.queues.length ? (
          <SearchGroup label="Queues">
            {searchResults.queues.map((queue) => {
              const currentIdx = idx++
              return (
                <SearchQueueItem
                  key={queue.id}
                  queue={queue}
                  active={activeIdx === currentIdx}
                  onSelect={() => handleSelect('queue', queue.id)}
                />
              )
            })}
          </SearchGroup>
        ) : null}
        {searchResults.skills.length ? (
          <SearchGroup label="Skills">
            {searchResults.skills.map((skill) => {
              const currentIdx = idx++
              return (
                <SearchSkillItem
                  key={skill.id}
                  skill={skill}
                  active={activeIdx === currentIdx}
                  onSelect={() => handleSelect('skill', skill.id)}
                />
              )
            })}
          </SearchGroup>
        ) : null}
      </>
    )
  }

  return (
    <div className="qsearch" id="globalSearch">
      <SearchIcon />
      <input
        ref={inputRef}
        id="qsearch"
        value={query}
        placeholder="Search…"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls="qsearchResults"
        aria-autocomplete="list"
        onFocus={openPanel}
        onChange={(event) => {
          setActiveIdx(-1)
          setQuery(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          blurTimerRef.current = setTimeout(() => closePanel(), 140)
        }}
      />
      <div
        ref={dropRef}
        className="qsearch-drop dropdown-panel"
        id="qsearchResults"
        role="listbox"
        hidden
        onMouseDown={handleDropMouseDown}
      >
        <div ref={bodyRef} className="qsearch-drop-body" id="qsearchBody">
          <div ref={contentRef} className="qsearch-drop-content" id="qsearchContent">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}
