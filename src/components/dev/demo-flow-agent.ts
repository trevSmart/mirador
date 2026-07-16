/* Agent sintètic per al Dev Lab: cues amb volums diferents per provar el
   QueueFlowChart amb una distribució més rica que la del snapshot mock (on
   cap agent passa de 2 cues).

   `DEMO_FLOW_AGENT` és la càrrega del mode SVG per fil (~35 items, densitat mitjana-alta).
   `DEMO_FLOW_AGENT_STRESS` multiplica el trànsit per estressar les variants
   per feix i canvas al comparar rendiment. */

import type { Agent, AgentWorkItem, ChannelKey } from '../../api/types'

interface DemoQueueRedirect {
  fromId: string
  toId: string
  count: number
}

const QUEUE_SPECS = [
  { id: 'demo-q-vendes', name: 'Vendes' },
  { id: 'demo-q-atencio', name: 'Atenció Client' },
  { id: 'demo-q-incidencies', name: 'Incidències' },
  { id: 'demo-q-retencio', name: 'Retenció' },
  // Cua de triatge inventada: no envia feina directament a l'agent, només
  // alimenta Retenció (flux cua → cua).
  { id: 'demo-q-triatge', name: 'Triatge' },
] as const

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
  id = 'demo-agent-flow',
  name = 'Agent de demo',
): Agent {
  const queues = QUEUE_SPECS.map((q) => ({ ...q, count: queueCounts[q.id] ?? 0 }))
  const work: AgentWorkItem[] = queues.flatMap((q, qi) =>
    Array.from({ length: q.count }, (_, i) => {
      const chan = CHANNELS[(qi + i) % CHANNELS.length]
      return {
        id: `demo-w-${id}-${q.id}-${i}`,
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
  'demo-q-vendes': 12,
  'demo-q-atencio': 9,
  'demo-q-incidencies': 9,
  'demo-q-retencio': 5,
  'demo-q-triatge': 0,
}

/** ~35 items assignats — SVG per fil (densitat mitjana-alta). */
export const DEMO_REDIRECTS: DemoQueueRedirect[] = [
  { fromId: 'demo-q-atencio', toId: 'demo-q-incidencies', count: 6 },
  { fromId: 'demo-q-triatge', toId: 'demo-q-retencio', count: 6 },
]

export const DEMO_FLOW_AGENT = buildDemoFlowAgent(NORMAL_COUNTS, 'Demo · 35 items')

/* Segon agent: comparteix les mateixes cues amb comptes diferents (fan-out
   real — les cues alimenten tots dos agents amb pesos distints). */
const NORMAL_COUNTS_2: Record<string, number> = {
  'demo-q-vendes': 6,
  'demo-q-atencio': 11,
  'demo-q-incidencies': 4,
  'demo-q-retencio': 8,
  'demo-q-triatge': 0,
}

export const DEMO_FLOW_AGENT_2 = buildDemoFlowAgent(
  NORMAL_COUNTS_2,
  'Demo · 29 items',
  'demo-agent-flow-2',
  'Agent de demo 2',
)

/** Els dos agents de demo per al flux fan-out. */
export const DEMO_FLOW_AGENTS = [DEMO_FLOW_AGENT, DEMO_FLOW_AGENT_2]

/** ~108 items + redireccions pesades — estressa per feix i canvas. */
const STRESS_COUNTS: Record<string, number> = {
  'demo-q-vendes': 36,
  'demo-q-atencio': 28,
  'demo-q-incidencies': 28,
  'demo-q-retencio': 16,
  'demo-q-triatge': 0,
}

const STRESS_COUNTS_2: Record<string, number> = {
  'demo-q-vendes': 20,
  'demo-q-atencio': 34,
  'demo-q-incidencies': 14,
  'demo-q-retencio': 24,
  'demo-q-triatge': 0,
}

export const DEMO_REDIRECTS_STRESS: DemoQueueRedirect[] = [
  { fromId: 'demo-q-atencio', toId: 'demo-q-incidencies', count: 22 },
  { fromId: 'demo-q-triatge', toId: 'demo-q-retencio', count: 20 },
]

export const DEMO_FLOW_AGENT_STRESS = buildDemoFlowAgent(
  STRESS_COUNTS,
  'Demo stress · 108 items',
)

export const DEMO_FLOW_AGENT_2_STRESS = buildDemoFlowAgent(
  STRESS_COUNTS_2,
  'Demo stress · 92 items',
  'demo-agent-flow-2',
  'Agent de demo 2',
)

/** Els dos agents de demo en variant stress. */
export const DEMO_FLOW_AGENTS_STRESS = [DEMO_FLOW_AGENT_STRESS, DEMO_FLOW_AGENT_2_STRESS]
