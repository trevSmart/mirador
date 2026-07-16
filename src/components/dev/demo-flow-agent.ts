/* Agent sintètic per al Dev Lab: cues amb volums diferents per provar el
   QueueFlowChart amb una distribució més rica que la del snapshot mock (on
   cap agent passa de 2 cues).

   `DEMO_FLOW_AGENT` és la càrrega del mode SVG per fil (~35 items, densitat mitjana-alta).
   `DEMO_FLOW_AGENT_STRESS` multiplica el trànsit per estressar les variants
   per feix i canvas al comparar rendiment. */

import type { Agent, AgentWorkItem, ChannelKey } from '../../api/types'
import { mockSfId, mockWorkItemId } from '../../api/mock/mock-ids'

interface DemoQueueRedirect {
  fromId: string
  toId: string
  count: number
}

/** Cues de demo — Ids 18-char amb prefix 00G (Group), seq 901+ per no
    xocar amb el seed mock (1–5). */
const DEMO_QUEUE = {
  vendes: mockSfId('00G', 901),
  atencio: mockSfId('00G', 902),
  incidencies: mockSfId('00G', 903),
  retencio: mockSfId('00G', 904),
  // Cua de triatge inventada: no envia feina directament a l'agent, només
  // alimenta Retenció (flux cua → cua).
  triatge: mockSfId('00G', 905),
} as const

const QUEUE_SPECS = [
  { id: DEMO_QUEUE.vendes, name: 'Vendes' },
  { id: DEMO_QUEUE.atencio, name: 'Atenció Client' },
  { id: DEMO_QUEUE.incidencies, name: 'Incidències' },
  { id: DEMO_QUEUE.retencio, name: 'Retenció' },
  { id: DEMO_QUEUE.triatge, name: 'Triatge' },
] as const

/** Agents de demo — prefix 005 (User), seq 901+. */
const DEMO_AGENT = {
  flow: mockSfId('005', 901),
  flow2: mockSfId('005', 902),
} as const

/** Base seq per work items de demo (prefix 0Bz); cada agent en consumeix un
    bloc ample perquè els ids no es solapin entre modes. */
const DEMO_WORK_SEQ = {
  flow: 9001,
  flow2: 9201,
  flowStress: 9401,
  flow2Stress: 9601,
} as const

/** Noms de les cues de demo (no existeixen a la caché d'entitats). */
export const DEMO_QUEUE_NAMES: Record<string, string> = Object.fromEntries(
  QUEUE_SPECS.map((q) => [q.id, q.name]),
)

const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'veu', label: 'Trucada entrant' },
  { key: 'chat', label: 'Conversa de chat' },
  { key: 'email', label: 'Correu de client' },
  { key: 'wa', label: 'WhatsApp' },
  { key: 'cas', label: 'Cas obert' },
]

function buildDemoFlowAgent(
  queueCounts: Record<string, number>,
  label: string,
  id: string,
  name: string,
  workSeqBase: number,
): Agent {
  const queues = QUEUE_SPECS.map((q) => ({ ...q, count: queueCounts[q.id] ?? 0 }))
  let workSeq = workSeqBase
  const work: AgentWorkItem[] = queues.flatMap((q, qi) =>
    Array.from({ length: q.count }, (_, i) => {
      const chan = CHANNELS[(qi + i) % CHANNELS.length]
      return {
        id: mockWorkItemId(workSeq++),
        recordId: null,
        label: `${chan.label} #${i + 1}`,
        subject: null,
        channel: chan.label,
        channelKey: chan.key,
        status: 'assigned' as const,
        queue: q.name,
        queueId: q.id,
        ageMin: 2 + qi * 3 + i,
      }
    }),
  )

  const chans = work.reduce(
    (acc, item) => {
      if (item.channelKey) acc[item.channelKey] = (acc[item.channelKey] ?? 0) + 1
      return acc
    },
    { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 } as Record<ChannelKey, number>,
  )

  return {
    id,
    name,
    role: label,
    recordUrl: null,
    status: 'online',
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: Math.max(work.length + 12, 12),
    used: work.length,
    queueIds: queues.map((q) => q.id),
    loginMin: 180,
    photo: null,
    chans,
    work,
    skills: [],
  }
}

const NORMAL_COUNTS: Record<string, number> = {
  [DEMO_QUEUE.vendes]: 12,
  [DEMO_QUEUE.atencio]: 9,
  [DEMO_QUEUE.incidencies]: 9,
  [DEMO_QUEUE.retencio]: 5,
  [DEMO_QUEUE.triatge]: 0,
}

/** ~35 items assignats — SVG per fil (densitat mitjana-alta). */
export const DEMO_REDIRECTS: DemoQueueRedirect[] = [
  { fromId: DEMO_QUEUE.atencio, toId: DEMO_QUEUE.incidencies, count: 6 },
  { fromId: DEMO_QUEUE.triatge, toId: DEMO_QUEUE.retencio, count: 6 },
]

export const DEMO_FLOW_AGENT = buildDemoFlowAgent(
  NORMAL_COUNTS,
  'Demo · 35 items',
  DEMO_AGENT.flow,
  'Agent de demo',
  DEMO_WORK_SEQ.flow,
)

/* Segon agent: comparteix les mateixes cues amb comptes diferents (fan-out
   real — les cues alimenten tots dos agents amb pesos distints). */
const NORMAL_COUNTS_2: Record<string, number> = {
  [DEMO_QUEUE.vendes]: 6,
  [DEMO_QUEUE.atencio]: 11,
  [DEMO_QUEUE.incidencies]: 4,
  [DEMO_QUEUE.retencio]: 8,
  [DEMO_QUEUE.triatge]: 0,
}

export const DEMO_FLOW_AGENT_2 = buildDemoFlowAgent(
  NORMAL_COUNTS_2,
  'Demo · 29 items',
  DEMO_AGENT.flow2,
  'Agent de demo 2',
  DEMO_WORK_SEQ.flow2,
)

/** Els dos agents de demo per al flux fan-out. */
export const DEMO_FLOW_AGENTS = [DEMO_FLOW_AGENT, DEMO_FLOW_AGENT_2]

/** ~108 items + redireccions pesades — estressa per feix i canvas. */
const STRESS_COUNTS: Record<string, number> = {
  [DEMO_QUEUE.vendes]: 36,
  [DEMO_QUEUE.atencio]: 28,
  [DEMO_QUEUE.incidencies]: 28,
  [DEMO_QUEUE.retencio]: 16,
  [DEMO_QUEUE.triatge]: 0,
}

const STRESS_COUNTS_2: Record<string, number> = {
  [DEMO_QUEUE.vendes]: 20,
  [DEMO_QUEUE.atencio]: 34,
  [DEMO_QUEUE.incidencies]: 14,
  [DEMO_QUEUE.retencio]: 24,
  [DEMO_QUEUE.triatge]: 0,
}

export const DEMO_REDIRECTS_STRESS: DemoQueueRedirect[] = [
  { fromId: DEMO_QUEUE.atencio, toId: DEMO_QUEUE.incidencies, count: 22 },
  { fromId: DEMO_QUEUE.triatge, toId: DEMO_QUEUE.retencio, count: 20 },
]

export const DEMO_FLOW_AGENT_STRESS = buildDemoFlowAgent(
  STRESS_COUNTS,
  'Demo stress · 108 items',
  DEMO_AGENT.flow,
  'Agent de demo',
  DEMO_WORK_SEQ.flowStress,
)

export const DEMO_FLOW_AGENT_2_STRESS = buildDemoFlowAgent(
  STRESS_COUNTS_2,
  'Demo stress · 92 items',
  DEMO_AGENT.flow2,
  'Agent de demo 2',
  DEMO_WORK_SEQ.flow2Stress,
)

/** Els dos agents de demo en variant stress. */
export const DEMO_FLOW_AGENTS_STRESS = [DEMO_FLOW_AGENT_STRESS, DEMO_FLOW_AGENT_2_STRESS]
