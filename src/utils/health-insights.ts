import type { Agent, Queue } from '../api/types'
import { formatDurationSec } from './format'
import { totalQueueBacklog } from './agent-stats'

export type HealthLevel = 'ok' | 'watch' | 'alert'

export type InsightTargetPanel = 'agents' | 'queues'

export interface HealthPillar {
  id: string
  targetPanel: InsightTargetPanel
  label: string
  value: string | number
  state: HealthLevel
  statusMessage: string
}

export interface HealthInsights {
  online: number
  backlog: number
  longest: number
  utilization: number
  helpFlags: number
  sla: number
  pillars: HealthPillar[]
  worst: HealthLevel
  title: string
  subtitle: string
  dot: HealthLevel
}

function level(value: number, watchThreshold: number, alertThreshold: number): HealthLevel {
  if (value >= alertThreshold) {
    return 'alert'
  }
  if (value >= watchThreshold) {
    return 'watch'
  }
  return 'ok'
}

function worstLevel(current: HealthLevel, next: HealthLevel): HealthLevel {
  const rank: Record<HealthLevel, number> = { ok: 0, watch: 1, alert: 2 }
  return rank[next] > rank[current] ? next : current
}

function buildVerdict(pillars: HealthPillar[], worst: HealthLevel): Pick<HealthInsights, 'title' | 'subtitle' | 'dot'> {
  const attention = pillars.filter((pillar) => pillar.state !== 'ok')

  if (worst === 'ok') {
    return {
      dot: 'ok',
      title: 'Tot va bé.',
      subtitle:
        'Cap cosa que requereixi la teva atenció ara mateix. Pots dedicar-te a una altra cosa amb tranquil·litat.',
    }
  }

  if (worst === 'watch') {
    const indicatorLabel = attention.length === 1 ? ' indicador' : ' indicadors'
    return {
      dot: 'watch',
      title: 'Tot bé, amb un ull a sobre.',
      subtitle: `Res urgent, però hi ha ${attention.length}${indicatorLabel} que val la pena vigilar: ${attention.map((pillar) => pillar.label.toLowerCase()).join(', ')}.`,
    }
  }

  const alerts = pillars.filter((pillar) => pillar.state === 'alert')
  return {
    dot: 'alert',
    title:
      alerts.length === 1 ? 'Una cosa necessita la teva atenció.' : 'Hi ha coses per atendre.',
    subtitle: `Mira ${alerts.map((pillar) => pillar.label.toLowerCase()).join(' i ')}. Toca per anar directe al detall.`,
  }
}

export function computeHealthInsights(
  agents: Agent[],
  queues: Queue[],
  { includeExtendedMetrics = true, helpFlags = 0 }: { includeExtendedMetrics?: boolean; helpFlags?: number } = {},
): HealthInsights {
  const online = agents.filter((agent) => agent.status === 'online').length
  const backlog = totalQueueBacklog(queues)
  const longest = queues.length ? Math.max(0, ...queues.map((queue) => queue.longest || 0)) : 0
  const totalCapacity = agents
    .filter((agent) => agent.status !== 'offline')
    .reduce((sum, agent) => sum + (agent.max || 0), 0)
  const totalUsed = agents.reduce((sum, agent) => sum + (agent.used || 0), 0)
  const utilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0
  const sla = Math.max(70, Math.min(99, 98 - Math.round(backlog * 0.9) - (longest > 180 ? 6 : 0)))

  const allPillars: HealthPillar[] = [
    {
      id: 'wait',
      targetPanel: 'queues',
      label: 'Espera',
      value: formatDurationSec(longest, { short: true }),
      state: level(longest, 150, 240),
      statusMessage:
        longest >= 240 ? 'sobre el llindar' : longest >= 150 ? 'pujant' : 'dins de marge',
    },
    {
      id: 'backlog',
      targetPanel: 'queues',
      label: 'Backlog',
      value: backlog,
      state: level(backlog, 18, 30),
      statusMessage: backlog >= 30 ? 'acumulant-se' : backlog >= 18 ? 'creixent' : 'estable',
    },
    {
      id: 'cover',
      targetPanel: 'agents',
      label: 'Cobertura',
      value: `${utilization}%`,
      state: level(utilization, 82, 93),
      statusMessage: utilization >= 93 ? 'al límit' : utilization >= 82 ? 'ajustada' : 'folgada',
    },
    {
      id: 'sla',
      targetPanel: 'queues',
      label: 'SLA',
      value: `${sla}%`,
      state: sla >= 90 ? 'ok' : sla >= 80 ? 'watch' : 'alert',
      statusMessage: sla >= 90 ? 'complint' : sla >= 80 ? 'al caire' : 'incomplint',
    },
    {
      id: 'help',
      targetPanel: 'agents',
      label: 'Ajuda',
      value: helpFlags,
      state: helpFlags === 0 ? 'ok' : helpFlags <= 1 ? 'watch' : 'alert',
      statusMessage:
        helpFlags === 0
          ? 'cap petició'
          : helpFlags === 1
            ? '1 agent espera'
            : `${helpFlags} agents esperen`,
    },
  ]

  const pillars = includeExtendedMetrics
    ? allPillars
    : allPillars.filter((pillar) => pillar.id !== 'sla' && pillar.id !== 'help')

  const worst = pillars.reduce<HealthLevel>(
    (current, pillar) => worstLevel(current, pillar.state),
    'ok',
  )

  return {
    online,
    backlog,
    longest,
    utilization,
    helpFlags,
    sla,
    pillars,
    worst,
    ...buildVerdict(pillars, worst),
  }
}
