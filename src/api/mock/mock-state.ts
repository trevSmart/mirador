import type {
  Agent,
  AgentWorkItem,
  ChannelKey,
  Queue,
  Skill,
  WorkItem,
} from '../types'
import { workItemIconFields } from '../../utils/salesforce-object-icon'
import {
  agents as seedAgents,
  getAgentSkills,
  queues as seedQueues,
  skillAgentSlice,
  skills as seedSkills,
  work as seedWork,
} from './mock-seed'

type PresenceStatus = Agent['status']

type MockLiveState = {
  agents: Agent[]
  queued: WorkItem[]
  skills: Skill[]
  workIdSeq: number
  caseSeq: number
  evolutionStep: number
}

const QUEUE_IDS = ['ac', 'in', 've', 'st', 're'] as const
const CHANNELS: ChannelKey[] = ['veu', 'chat', 'email', 'wa', 'cas']

const EMAIL_SUBJECTS = [
  'Email consulta general',
  'Email reclamació',
  'Email oferta comercial',
  'Email consulta tècnica',
  'Email facturació',
  'Email seguiment',
]

const ACTIVE_STATUSES = new Set<PresenceStatus>(['online', 'busy', 'away'])

let state: MockLiveState | null = null
let lastEvolveMs = 0

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cloneInitialState(): MockLiveState {
  const agents = structuredClone(seedAgents)
  const queued = structuredClone(seedWork.filter((item) => item.status === 'queued'))
  const skills = structuredClone(seedSkills)

  let caseSeq = 48_990
  for (const item of seedWork) {
    const match = item.subject.match(/Cas #(\d+)/)
    if (match) {
      caseSeq = Math.max(caseSeq, Number.parseInt(match[1], 10))
    }
  }

  return {
    agents,
    queued,
    skills,
    workIdSeq: seedWork.length,
    caseSeq,
    evolutionStep: 0,
  }
}

function nextWorkId(stateRef: MockLiveState): string {
  const id = `w${stateRef.workIdSeq}`
  stateRef.workIdSeq += 1
  return id
}

function nextCaseSubject(stateRef: MockLiveState): string {
  stateRef.caseSeq += 1
  return `Cas #${stateRef.caseSeq}`
}

function subjectForChannel(
  stateRef: MockLiveState,
  channelKey: ChannelKey,
  rand: () => number,
): string {
  switch (channelKey) {
    case 'veu':
      return 'Trucada entrant'
    case 'chat':
      return 'Xat web'
    case 'wa':
      return rand() < 0.25 ? 'WhatsApp urgència' : 'WhatsApp'
    case 'email':
      return EMAIL_SUBJECTS[Math.floor(rand() * EMAIL_SUBJECTS.length)]
    case 'cas':
      return nextCaseSubject(stateRef)
  }
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]
}

function syncAgentChannels(agent: Agent): void {
  const chans = { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 }
  for (const item of agent.work) {
    chans[item.channelKey] += 1
  }
  agent.chans = chans
  agent.used = agent.work.length
}

function reconcileAgentStatus(agent: Agent): void {
  if (agent.status === 'offline') {
    return
  }
  if (agent.used >= agent.max) {
    agent.status = 'busy'
    return
  }
  if (agent.status === 'busy' && agent.used < agent.max) {
    agent.status = 'online'
  }
}

function agentWorkToWorkItem(agent: Agent, workItem: AgentWorkItem): WorkItem {
  const icon = workItemIconFields(workItem.channelKey)
  return {
    id: workItem.id,
    subject: workItem.subject ?? workItem.label,
    channelKey: workItem.channelKey,
    queueId: workItem.queueId,
    agentId: agent.id,
    status: 'assigned',
    ageSec: (workItem.ageMin ?? 1) * 60,
    workItemId: workItem.recordId,
    objectApiName: icon.objectApiName,
    iconName: icon.iconName,
    iconSprite: icon.iconSprite,
    iconSymbol: icon.iconSymbol,
  }
}

function buildFlatWork(stateRef: MockLiveState): WorkItem[] {
  const assigned: WorkItem[] = []
  for (const agent of stateRef.agents) {
    for (const item of agent.work) {
      assigned.push(agentWorkToWorkItem(agent, item))
    }
  }
  return [...assigned, ...stateRef.queued]
}

function buildQueues(stateRef: MockLiveState): Queue[] {
  const seedById = new Map(seedQueues.map((queue) => [queue.id, queue]))

  return seedQueues.map((seedQueue) => {
    const queuedForQueue = stateRef.queued.filter(
      (item) => item.queueId === seedQueue.id,
    )
    const backlog = queuedForQueue.length
    const ages = queuedForQueue.map((item) => item.ageSec)
    const longest = ages.length ? Math.max(...ages) : seedQueue.longest
    const avg = ages.length
      ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
      : seedQueue.avg
    const online =
      stateRef.agents.filter(
        (agent) =>
          agent.queueIds.includes(seedQueue.id) && agent.status === 'online',
      ).length || 1

    return {
      ...seedQueue,
      backlog,
      longest,
      avg,
      online,
      color: seedById.get(seedQueue.id)?.color ?? seedQueue.color,
    }
  })
}

function refreshSkillBacklog(stateRef: MockLiveState): void {
  const rand = mulberry32(stateRef.evolutionStep * 1_009 + 17)
  for (const skill of stateRef.skills) {
    const delta = rand() < 0.45 ? -1 : rand() < 0.7 ? 0 : 1
    skill.backlog = Math.max(0, skill.backlog + delta)
  }
}

function ageWork(stateRef: MockLiveState, seconds: number): void {
  for (const agent of stateRef.agents) {
    for (const item of agent.work) {
      item.ageMin = Math.max(1, item.ageMin + Math.round(seconds / 60))
    }
    if (ACTIVE_STATUSES.has(agent.status) && agent.loginMin > 0) {
      agent.loginMin += Math.max(1, Math.round(seconds / 60))
    }
  }
  for (const item of stateRef.queued) {
    item.ageSec += seconds
  }
}

function completeSomeWork(stateRef: MockLiveState, rand: () => number): void {
  const byAgent = new Map<string, { agent: Agent; index: number; score: number }[]>()

  for (const agent of stateRef.agents) {
    if (!ACTIVE_STATUSES.has(agent.status)) continue
    const picks: { agent: Agent; index: number; score: number }[] = []
    agent.work.forEach((item, index) => {
      const score = item.ageMin + rand()
      if (item.ageMin >= 4 || (item.channelKey === 'veu' && item.ageMin >= 2)) {
        picks.push({ agent, index, score })
      }
    })
    if (picks.length) {
      byAgent.set(agent.id, picks)
    }
  }

  let remaining = rand() < 0.35 ? 2 : 1
  const agents = [...byAgent.values()].sort(() => rand() - 0.5)

  for (const picks of agents) {
    if (remaining <= 0) break
    const best = picks.sort((a, b) => b.score - a.score)[0]
    best.agent.work.splice(best.index, 1)
    syncAgentChannels(best.agent)
    reconcileAgentStatus(best.agent)
    remaining -= 1
  }
}

function enqueueIncomingWork(stateRef: MockLiveState, rand: () => number): void {
  const count = rand() < 0.25 ? 2 : 1
  for (let i = 0; i < count; i++) {
    const queueId = pick(QUEUE_IDS, rand)
    const channelKey = pick(CHANNELS, rand)
    const icon = workItemIconFields(channelKey)
    stateRef.queued.push({
      id: nextWorkId(stateRef),
      subject: subjectForChannel(stateRef, channelKey, rand),
      channelKey,
      queueId,
      agentId: null,
      status: 'queued',
      ageSec: 10 + Math.floor(rand() * 90),
      workItemId: null,
      objectApiName: icon.objectApiName,
      iconName: icon.iconName,
      iconSprite: icon.iconSprite,
      iconSymbol: icon.iconSymbol,
    })
  }
}

function assignQueuedWork(stateRef: MockLiveState, rand: () => number): void {
  const availableAgents = stateRef.agents
    .filter(
      (agent) =>
        ACTIVE_STATUSES.has(agent.status) &&
        agent.used < agent.max &&
        agent.status !== 'away',
    )
    .sort(() => rand() - 0.5)

  if (!availableAgents.length || !stateRef.queued.length) return

  const assignments = rand() < 0.55 ? 1 : 0
  for (let i = 0; i < assignments; i++) {
    const queueIndex = stateRef.queued.findIndex((item) => {
      const agent = availableAgents[i % availableAgents.length]
      return item.queueId != null && agent.queueIds.includes(item.queueId)
    })
    if (queueIndex < 0) break

    const agent = availableAgents[i % availableAgents.length]
    const [queuedItem] = stateRef.queued.splice(queueIndex, 1)
    if (!queuedItem.queueId) continue

    agent.work.push({
      id: `${agent.id}-work-${agent.work.length}`,
      recordId: null,
      label: queuedItem.subject,
      subject: queuedItem.subject,
      channel: null,
      channelKey: queuedItem.channelKey,
      status: 'assigned',
      queue: seedQueues.find((q) => q.id === queuedItem.queueId)?.name ?? null,
      queueId: queuedItem.queueId,
      ageMin: Math.max(1, Math.floor(queuedItem.ageSec / 60)),
    })
    syncAgentChannels(agent)
    reconcileAgentStatus(agent)
  }
}

function moveAgentWorkToQueue(agent: Agent, stateRef: MockLiveState): void {
  for (const item of agent.work) {
    const icon = workItemIconFields(item.channelKey)
    stateRef.queued.push({
      id: nextWorkId(stateRef),
      subject: item.subject ?? item.label,
      channelKey: item.channelKey,
      queueId: item.queueId,
      agentId: null,
      status: 'queued',
      ageSec: (item.ageMin ?? 1) * 60,
      workItemId: item.recordId,
      objectApiName: icon.objectApiName,
      iconName: icon.iconName,
      iconSprite: icon.iconSprite,
      iconSymbol: icon.iconSymbol,
    })
  }
  agent.work = []
  syncAgentChannels(agent)
}

function shiftPresence(stateRef: MockLiveState, rand: () => number): void {
  const transitions: Array<{
    from: PresenceStatus
    to: PresenceStatus
    chance: number
    limit: number
  }> = [
    { from: 'offline', to: 'online', chance: 0.12, limit: 1 },
    { from: 'away', to: 'online', chance: 0.22, limit: 1 },
    { from: 'online', to: 'away', chance: 0.08, limit: 1 },
    { from: 'online', to: 'offline', chance: 0.05, limit: 1 },
    { from: 'busy', to: 'away', chance: 0.04, limit: 1 },
  ]

  for (const transition of transitions) {
    let changed = 0
    const pool = stateRef.agents
      .filter((agent) => agent.status === transition.from)
      .sort(() => rand() - 0.5)

    for (const agent of pool) {
      if (changed >= transition.limit) break
      if (rand() > transition.chance) continue

      if (transition.to === 'offline') {
        moveAgentWorkToQueue(agent, stateRef)
        agent.loginMin = 0
      } else if (transition.from === 'offline' && transition.to === 'online') {
        agent.loginMin = 5 + Math.floor(rand() * 40)
      }

      agent.status = transition.to
      changed += 1
    }
  }
}

function evolveState(stateRef: MockLiveState): void {
  const rand = mulberry32(stateRef.evolutionStep * 9_173 + 42)
  stateRef.evolutionStep += 1

  ageWork(stateRef, 25 + Math.floor(rand() * 35))
  completeSomeWork(stateRef, rand)
  enqueueIncomingWork(stateRef, rand)
  assignQueuedWork(stateRef, rand)
  shiftPresence(stateRef, rand)
  refreshSkillBacklog(stateRef)

  for (const agent of stateRef.agents) {
    syncAgentChannels(agent)
    reconcileAgentStatus(agent)
  }
}

function prepareState(): MockLiveState {
  if (!state) {
    state = cloneInitialState()
    return state
  }

  const now = Date.now()
  if (now > lastEvolveMs) {
    if (lastEvolveMs > 0) {
      evolveState(state)
    }
    lastEvolveMs = now
  }

  return state
}

export function getMockAgents(): Agent[] {
  const live = prepareState()
  return live.agents.map((agent) => ({
    ...agent,
    skills: getAgentSkills(agent.id),
  }))
}

export function getMockQueues(): Queue[] {
  return buildQueues(prepareState())
}

export function getMockSkills(): Skill[] {
  return prepareState().skills.slice()
}

export function getMockWork(): WorkItem[] {
  return buildFlatWork(prepareState())
}

export function getMockSkillAgents(skillId: string): Agent[] {
  const live = prepareState()
  const skill = live.skills.find((entry) => entry.id === skillId)
  if (!skill) return []
  return skillAgentSlice(skill, live.agents).map((agent) => ({
    ...agent,
    skills: getAgentSkills(agent.id),
  }))
}
