import type {
  Agent,
  AgentSkill,
  AgentWorkItem,
  ChannelKey,
  Queue,
  Skill,
  WorkItem,
} from '../types'
import { workItemIconFields } from '../../utils/salesforce-object-icon'

const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a
const pick = <T,>(arr: readonly T[]): T => arr[rnd(0, arr.length - 1)]

type QueueDef = { id: string; name: string; color: string }

const QUEUE_DEFS: QueueDef[] = [
  { id: 'ac', name: 'Atenció Client', color: '#6A5BE8' },
  { id: 'in', name: 'Incidències', color: '#E05641' },
  { id: 've', name: 'Vendes', color: '#15A06A' },
  { id: 'st', name: 'Suport Tècnic', color: '#D9981F' },
  { id: 're', name: 'Retenció', color: '#A98AFF' },
]

const SKILL_DEFS: Skill[] = [
  { id: 'ca', name: 'Català', type: 'Language', agents: 14, backlog: 3 },
  { id: 'es', name: 'Castellà', type: 'Language', agents: 18, backlog: 7 },
  { id: 'en', name: 'Anglès', type: 'Language', agents: 9, backlog: 2 },
  { id: 'fr', name: 'Francès', type: 'Language', agents: 5, backlog: 0 },
  { id: 'tec', name: 'Suport tècnic L2', type: 'Expertise', agents: 6, backlog: 5 },
  { id: 'ven', name: 'Vendes outbound', type: 'Expertise', agents: 4, backlog: 1 },
  { id: 'ret', name: 'Retenció premium', type: 'Expertise', agents: 3, backlog: 4 },
]

const NAMES: [string, string][] = [
  ['Núria Ferran', 'Sènior · Atenció'],
  ['Pau Vidal', 'Agent · Vendes'],
  ['Aisha Khan', 'Agent · Suport'],
  ['Marc Soler', 'Sènior · Incidències'],
  ['Lucía Ortega', 'Agent · Atenció'],
  ['Tariq Aziz', 'Agent · Retenció'],
  ['Emma Roca', 'Agent · Vendes'],
  ['Jordi Camps', 'Sènior · Suport'],
  ['Sara Lloret', 'Agent · Atenció'],
  ['Hugo Marín', 'Agent · Incidències'],
  ['Mei Chen', 'Agent · Suport'],
  ['Olga Prats', 'Agent · Retenció'],
  ['Iván Mora', 'Agent · Vendes'],
  ['Carla Bru', 'Sènior · Atenció'],
  ['Adam Novak', 'Agent · Incidències'],
  ['Laia Pons', 'Agent · Suport'],
  ['Èric Sala', 'Agent · Atenció'],
  ['Júlia Vives', 'Agent · Vendes'],
  ['Omar Haddad', 'Agent · Suport'],
  ['Berta Coll', 'Agent · Incidències'],
  ['Nil Bosch', 'Agent · Retenció'],
  ['Paula Gil', 'Sènior · Vendes'],
  ['Roger Mas', 'Agent · Suport'],
  ['Anna Tort', 'Agent · Atenció'],
  ['Dani Reig', 'Agent · Incidències'],
  ['Clara Vega', 'Agent · Vendes'],
  ['Marta Pi', 'Agent · Suport'],
  ['Pol Esteve', 'Agent · Retenció'],
  ['Júlia Font', 'Agent · Atenció'],
  ['Saïd Amraoui', 'Agent · Suport'],
  ['Ona Serra', 'Agent · Vendes'],
  ['Bru Llopis', 'Agent · Incidències'],
  ['Vera Soto', 'Agent · Atenció'],
  ['Guillem Rius', 'Agent · Suport'],
]

const WORK_KINDS: { channelKey: ChannelKey; t: string; q: string }[] = [
  { channelKey: 'veu', t: 'Trucada entrant', q: 'ac' },
  { channelKey: 'chat', t: 'Xat web', q: 'st' },
  { channelKey: 'cas', t: 'Cas #', q: 'in' },
  { channelKey: 'wa', t: 'WhatsApp', q: 've' },
  { channelKey: 'email', t: 'Email', q: 'ac' },
]

const MOCK_SKILL_EPOCH = Date.UTC(2025, 0, 1)

const queueNameById = new Map(QUEUE_DEFS.map((queue) => [queue.id, queue.name]))

function skillAgentSlice(skill: Skill, roster: Agent[]): Agent[] {
  const want = Math.min(skill.agents, roster.length)
  if (!want) return []
  let seed = 0
  for (let i = 0; i < skill.id.length; i++) {
    seed = (seed * 31 + skill.id.charCodeAt(i)) % roster.length
  }
  const picked: Agent[] = []
  for (let i = 0; i < want; i++) {
    picked.push(roster[(seed + i) % roster.length])
  }
  return picked
}

function agentSkillRows(agentId: string, roster: Agent[]): AgentSkill[] {
  const out: AgentSkill[] = []
  SKILL_DEFS.forEach((skill, si) => {
    if (!skillAgentSlice(skill, roster).some((agent) => agent.id === agentId)) {
      return
    }
    const span = ((String(agentId).length + si) * 37) % 240 + 5
    const start = MOCK_SKILL_EPOCH + span * 86_400_000
    out.push({
      id: `${agentId}-${skill.id}`,
      skillId: skill.id,
      name: skill.name,
      type: skill.type,
      level: (si % 5) + 1,
      startDate: new Date(start).toISOString(),
      lastModifiedDate: new Date(start + 86_400_000 * (si + 1)).toISOString(),
      lastModifiedBy: 'Sistema (mock)',
    })
  })
  return out
}

function buildAgentWork(
  agentId: string,
  kind: { channelKey: ChannelKey; t: string; q: string },
  workSec: number,
): AgentWorkItem {
  const subject = kind.t === 'Cas #' ? `Cas #${rnd(48_210, 48_999)}` : kind.t
  return {
    id: `${agentId}-work-0`,
    recordId: null,
    label: subject,
    subject,
    channel: null,
    channelKey: kind.channelKey,
    status: 'assigned',
    queue: queueNameById.get(kind.q) ?? null,
    queueId: kind.q,
    ageMin: Math.max(1, Math.floor(workSec / 60)),
  }
}

function workIconFields(channelKey: ChannelKey) {
  return workItemIconFields(channelKey)
}

function buildAgents(): Agent[] {
  const N = NAMES.length
  return NAMES.map(([name, role], i) => {
    const status =
      i < N * 0.6 ? 'online' : i < N * 0.72 ? 'busy' : i < N * 0.84 ? 'away' : 'offline'
    const max = pick([4, 5, 5, 6])
    const used =
      status === 'offline' ? 0 : status === 'away' ? rnd(0, 1) : rnd(1, max)
    const chans = { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 }
    let left = used
    while (left > 0) {
      chans[pick(['veu', 'chat', 'wa', 'cas', 'email'] as ChannelKey[])]++
      left--
    }
    const queueIds = [pick(QUEUE_DEFS).id, pick(QUEUE_DEFS).id]
    const activeKind = used > 0 ? { ...pick(WORK_KINDS) } : null
    const workSec = activeKind ? rnd(40, 900) : 0
    const id = `a${i}`

    return {
      id,
      name,
      role,
      recordUrl: null,
      status,
      max,
      used,
      queueIds,
      loginMin: status === 'offline' ? 0 : rnd(25, 380),
      photo: null,
      chans,
      work: activeKind ? [buildAgentWork(id, activeKind, workSec)] : [],
      skills: [],
    }
  })
}

function buildQueues(agentRoster: Agent[]): Queue[] {
  return QUEUE_DEFS.map((queue) => ({
    ...queue,
    backlog: rnd(1, 9),
    longest: rnd(20, 150),
    avg: rnd(20, 90),
    online:
      agentRoster.filter(
        (agent) => agent.queueIds.includes(queue.id) && agent.status === 'online',
      ).length || rnd(1, 4),
  }))
}

function buildWork(agentRoster: Agent[]): WorkItem[] {
  const items: WorkItem[] = []
  let n = 0

  agentRoster.forEach((agent) => {
    agent.work.forEach((workItem) => {
      const icon = workIconFields(workItem.channelKey)
      items.push({
        id: `w${n++}`,
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
      })
    })
  })

  QUEUE_DEFS.forEach((queue) => {
    const backlog = rnd(1, 6)
    for (let i = 0; i < backlog; i++) {
      const kind = pick(WORK_KINDS.filter((entry) => entry.q === queue.id)) ?? pick(WORK_KINDS)
      const subject = kind.t === 'Cas #' ? `Cas #${rnd(48_210, 48_999)}` : kind.t
      const icon = workIconFields(kind.channelKey)
      items.push({
        id: `w${n++}`,
        subject,
        channelKey: kind.channelKey,
        queueId: queue.id,
        agentId: null,
        status: 'queued',
        ageSec: rnd(15, 1200),
        workItemId: null,
        objectApiName: icon.objectApiName,
        iconName: icon.iconName,
        iconSprite: icon.iconSprite,
        iconSymbol: icon.iconSymbol,
      })
    }
  })

  return items
}

export const agents = buildAgents()
export const queues = buildQueues(agents)
export const skills = SKILL_DEFS.slice()
export const work = buildWork(agents)

export function getSkillAgents(skillId: string): Agent[] {
  const skill = skills.find((entry) => entry.id === skillId)
  if (!skill) return []
  return skillAgentSlice(skill, agents).map((agent) => ({
    ...agent,
    skills: agentSkillRows(agent.id, agents),
  }))
}

export function getAgentSkills(agentId: string): AgentSkill[] {
  return agentSkillRows(agentId, agents)
}
