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
  /** Wandering load factor: negative = calmer, positive = busier. */
  loadBias: number
}

const QUEUE_IDS = ['ac', 'in', 've', 'st', 're'] as const
const CHANNELS: ChannelKey[] = ['veu', 'chat', 'email', 'wa', 'cas']

/** Target backlog per queue — simulation drifts around these levels. */
const QUEUE_TARGET_BACKLOG: Record<(typeof QUEUE_IDS)[number], number> = {
  ac: 7,
  in: 13,
  ve: 5,
  st: 10,
  re: 4,
}

const EMAIL_SUBJECTS = [
  'Email consulta general',
  'Email reclamació',
  'Email oferta comercial',
  'Email consulta tècnica',
  'Email facturació',
  'Email seguiment',
]

const ACTIVE_STATUSES = new Set<PresenceStatus>(['online', 'busy', 'away'])

/** Minimum agents per presence bucket so mock mode keeps visible variety. */
const MIN_PRESENCE_COUNTS: Partial<Record<PresenceStatus, number>> = {
  offline: 4,
  away: 5,
  busy: 4,
}

const EVOLVE_COOLDOWN_MS = 2_500

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
    loadBias: 0,
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

function queueBacklog(stateRef: MockLiveState, queueId: string): number {
  return stateRef.queued.filter((item) => item.queueId === queueId).length
}

function availableAgents(stateRef: MockLiveState): Agent[] {
  return stateRef.agents.filter(
    (agent) =>
      ACTIVE_STATUSES.has(agent.status) &&
      agent.status !== 'away' &&
      agent.used < agent.max,
  )
}

function pickWeightedQueue(stateRef: MockLiveState, rand: () => number): string {
  const weights = QUEUE_IDS.map((queueId) => {
    const backlog = queueBacklog(stateRef, queueId)
    const target = QUEUE_TARGET_BACKLOG[queueId]
    return Math.max(0.15, target + 1 - backlog * 0.35)
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rand() * total
  for (let i = 0; i < QUEUE_IDS.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return QUEUE_IDS[i]
  }
  return QUEUE_IDS[QUEUE_IDS.length - 1]
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
  if (agent.status === 'offline' || agent.status === 'away') {
    return
  }
  if (agent.used >= agent.max) {
    agent.status = 'busy'
    return
  }
  if (agent.status === 'busy' && agent.used === 0) {
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

  let remaining =
    rand() < 0.12 ? 0 : rand() < 0.28 ? 3 : rand() < 0.55 ? 2 : 1
  remaining = Math.max(
    0,
    Math.floor(remaining * (1 - stateRef.loadBias * 0.2) + (rand() < 0.08 ? 1 : 0)),
  )
  if (remaining === 0) return
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

function pushQueuedWork(
  stateRef: MockLiveState,
  queueId: string,
  channelKey: ChannelKey,
  rand: () => number,
): void {
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

function driftLoadBias(stateRef: MockLiveState, rand: () => number): void {
  stateRef.loadBias = Math.max(
    -1,
    Math.min(1, stateRef.loadBias + (rand() - 0.47) * 0.52),
  )
  if (rand() < 0.09) {
    stateRef.loadBias = Math.max(-1, Math.min(1, rand() * 2 - 1))
  }
}
function totalQueueTarget(): number {
  return Object.values(QUEUE_TARGET_BACKLOG).reduce((sum, target) => sum + target, 0)
}

function enqueueIncomingWork(stateRef: MockLiveState, rand: () => number): void {
  const totalBacklog = stateRef.queued.length
  const totalTarget = totalQueueTarget()
  const deficit = totalTarget - totalBacklog
  const surplus = totalBacklog - totalTarget
  const bias = stateRef.loadBias

  // Occasional rush — one queue gets a short spike of inbound work.
  const rushChance = 0.08 + Math.max(0, bias) * 0.1
  if (rand() < rushChance) {
    const rushQueue = pickWeightedQueue(stateRef, rand)
    const rushCount = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < rushCount; i++) {
      pushQueuedWork(stateRef, rushQueue, pick(CHANNELS, rand), rand)
    }
  }

  let arrivalChance: number
  if (surplus > 14) {
    arrivalChance = 0.12
  } else if (deficit > 0) {
    arrivalChance = 0.34 + Math.min(0.38, deficit * 0.025)
  } else {
    arrivalChance = 0.3
  }
  arrivalChance = Math.min(0.88, arrivalChance + bias * 0.22)
  if (rand() > arrivalChance) return

  const count =
    rand() < 0.1 + Math.max(0, bias) * 0.08
      ? 3
      : rand() < 0.28
        ? 2
        : 1

  for (let i = 0; i < count; i++) {
    const queueId = pickWeightedQueue(stateRef, rand)
    const backlog = queueBacklog(stateRef, queueId)
    const target = QUEUE_TARGET_BACKLOG[queueId as (typeof QUEUE_IDS)[number]]
    if (backlog >= target * 3.2 && rand() < 0.65) continue

    pushQueuedWork(stateRef, queueId, pick(CHANNELS, rand), rand)
  }
}

function assignQueuedWork(stateRef: MockLiveState, rand: () => number): void {
  if (!stateRef.queued.length) return

  const freeSlots = availableAgents(stateRef).reduce(
    (sum, agent) => sum + (agent.max - agent.used),
    0,
  )
  if (freeSlots <= 0) return

  const totalBacklog = stateRef.queued.length
  const totalTarget = totalQueueTarget()
  const deficit = totalTarget - totalBacklog
  const surplus = totalBacklog - totalTarget
  const bias = stateRef.loadBias

  let maxAssignments: number
  if (deficit > 8) {
    maxAssignments = rand() < 0.55 ? 1 : 0
  } else if (surplus > 5) {
    maxAssignments = 2 + Math.floor(rand() * 4)
  } else {
    maxAssignments = rand() < 0.42 ? 0 : 1 + Math.floor(rand() * 2)
  }

  const biasScale = 1 - bias * 0.28
  maxAssignments = Math.max(
    0,
    Math.floor(maxAssignments * biasScale + (rand() < 0.12 ? -1 : 0)),
  )

  maxAssignments = Math.min(
    stateRef.queued.length,
    freeSlots,
    maxAssignments,
  )

  for (let i = 0; i < maxAssignments; i++) {
    const agents = availableAgents(stateRef).sort(() => rand() - 0.5)
    if (!agents.length) break

    let assigned = false
    for (const agent of agents) {
      const queueIndex = stateRef.queued.findIndex(
        (item) => item.queueId != null && agent.queueIds.includes(item.queueId),
      )
      if (queueIndex < 0) continue

      const [queuedItem] = stateRef.queued.splice(queueIndex, 1)
      if (!queuedItem.queueId) continue

      agent.work.push({
        id: nextWorkId(stateRef),
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
      assigned = true
      break
    }

    if (!assigned) break
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

function enforcePresenceMix(stateRef: MockLiveState, rand: () => number): void {
  const counts: Record<PresenceStatus, number> = {
    online: 0,
    busy: 0,
    away: 0,
    offline: 0,
  }
  for (const agent of stateRef.agents) {
    counts[agent.status] += 1
  }

  const demoteOrder: PresenceStatus[] = ['online', 'busy', 'away']
  const targetStatuses: PresenceStatus[] = ['offline', 'away', 'busy']

  for (let i = 0; i < targetStatuses.length; i += 1) {
    const status = targetStatuses[i]
    const minimum = MIN_PRESENCE_COUNTS[status] ?? 0
    let deficit = minimum - counts[status]
    if (deficit <= 0) continue

    const donors = demoteOrder
      .flatMap((from) =>
        stateRef.agents.filter((agent) => agent.status === from),
      )
      .sort(() => rand() - 0.5)

    for (const agent of donors) {
      if (deficit <= 0) break
      if (status === 'offline') {
        moveAgentWorkToQueue(agent, stateRef)
        agent.loginMin = 0
      } else if (status === 'away' && agent.status === 'online') {
        agent.loginMin = Math.max(agent.loginMin, 5)
      }
      counts[agent.status] -= 1
      agent.status = status
      counts[status] += 1
      deficit -= 1
    }
  }
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
    { from: 'online', to: 'away', chance: 0.1, limit: 1 },
    { from: 'online', to: 'offline', chance: 0.07, limit: 1 },
    { from: 'busy', to: 'away', chance: 0.06, limit: 1 },
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

  enforcePresenceMix(stateRef, rand)
}

function evolveState(stateRef: MockLiveState): void {
  const rand = mulberry32(stateRef.evolutionStep * 9_173 + 42)
  stateRef.evolutionStep += 1

  driftLoadBias(stateRef, rand)
  ageWork(stateRef, 25 + Math.floor(rand() * 35))
  completeSomeWork(stateRef, rand)
  assignQueuedWork(stateRef, rand)
  enqueueIncomingWork(stateRef, rand)
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
    lastEvolveMs = Date.now()
    return state
  }

  const now = Date.now()
  if (now - lastEvolveMs >= EVOLVE_COOLDOWN_MS) {
    evolveState(state)
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
