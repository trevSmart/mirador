import { useMemo } from 'react'
import { useAgents, useDataStatus, useQueues, useWork } from '../api/data-hooks'
import { useAuth } from '../auth/auth-context'
import { PanelState } from '../components/PanelState'
import { SfIcon } from '../components/ds/SfIcon'
import { BigStat } from '../components/wallboard/BigStat'
import { DonutChart } from '../components/wallboard/DonutChart'
import { HBarChart } from '../components/wallboard/HBarChart'
import { VBarChart } from '../components/wallboard/VBarChart'
import { WallboardCard } from '../components/wallboard/WallboardCard'
import { formatDurationSec } from '../utils/format'
import {
  agentWorkStatus,
  capacityStatus,
  presenceStatuses,
  raisedFlags,
  usedCapacity,
  waitTime,
  workItemStatus,
  workPerformance,
} from '../utils/wallboard-metrics'

/** seconds → "—" when null, else short duration. */
function fmt(sec: number | null): string | null {
  return sec == null ? null : formatDurationSec(sec, { short: false })
}

/* Command Center for Service — Wallboard tab, faithfully replicated from the
   standard Omni Supervisor wallboard. A grid of real-time metric cards;
   metrics with no Mirador source are derived/mocked (see wallboard-metrics). */
export function WallboardPanel() {
  const agents = useAgents()
  const queues = useQueues()
  const work = useWork()
  const { isLoading, error, refresh } = useDataStatus()
  const { isMockMode } = useAuth()

  const m = useMemo(() => {
    const wait = waitTime(queues, work)
    const perf = workPerformance(agents, work, isMockMode)
    return {
      workItem: workItemStatus(work),
      capacity: capacityStatus(agents),
      wait,
      usedCap: usedCapacity(agents),
      presence: presenceStatuses(agents),
      flags: raisedFlags(agents, isMockMode),
      workStatus: agentWorkStatus(agents, work, isMockMode),
      perf,
    }
  }, [agents, queues, work, isMockMode])

  return (
    <PanelState
      panelType="wallboard"
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={agents.length === 0 && queues.length === 0}
      emptyMessage="No hi ha dades operatives per mostrar."
      hideHeader
      shellClassName="panel-shell--wallboard"
    >
      <div className="wb">
        <header className="wb__topbar">
          <div className="wb__controls">
            <button type="button" className="wb__control" aria-label="Time range">
              <SfIcon sprite="utility" symbol="clock" bg="#747474" sldsSize="x-small" />
              <SfIcon sprite="utility" symbol="down" bg="#747474" sldsSize="xx-small" />
            </button>
            <button type="button" className="wb__control" aria-label="Filter">
              <SfIcon sprite="utility" symbol="filterList" bg="#747474" sldsSize="x-small" />
            </button>
            <button type="button" className="wb__control" aria-label="Settings">
              <SfIcon sprite="utility" symbol="settings" bg="#747474" sldsSize="x-small" />
            </button>
          </div>
        </header>

        <div className="wb__grid">
          {/* 1 · Work Item Status */}
          <WallboardCard
            title="Work Item Status"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'record_create' }}
            iconBg="#f96cad"
          >
            <VBarChart data={m.workItem} />
          </WallboardCard>

          {/* 2 · Agent Primary Capacity Status */}
          <WallboardCard
            title="Agent Primary Capacity Status"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'capacity_plan' }}
            iconBg="#3ba755"
          >
            <VBarChart data={m.capacity} />
          </WallboardCard>

          {/* 3 · Wait Time */}
          <WallboardCard
            title="Wait Time"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'waits' }}
            iconBg="#e8912a"
          >
            <BigStat
              variant="stack"
              items={[
                { label: 'Average Wait Time', value: fmt(m.wait.averageSec) },
                { label: 'Longest Wait Time', value: fmt(m.wait.longestSec) },
              ]}
            />
          </WallboardCard>

          {/* 4 · Agent Primary Capacity */}
          <WallboardCard
            title="Agent Primary Capacity"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'work_capacity_limit' }}
            iconBg="#0d9dda"
          >
            <DonutChart ratio={m.usedCap.ratio} />
          </WallboardCard>

          {/* 5 · Agent Presence Statuses */}
          <WallboardCard
            title="Agent Presence Statuses"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'agent_session' }}
            iconBg="#3ba755"
          >
            <HBarChart data={m.presence} />
          </WallboardCard>

          {/* 6 · Raised Flags */}
          <WallboardCard
            title="Raised Flags"
            period="Current"
            icon={{ sprite: 'standard', symbol: 'custom_notification' }}
            iconBg="#e8627c"
            comingSoon
          >
            <BigStat variant="single" items={[{ label: 'Raised Flags', value: String(m.flags) }]} />
          </WallboardCard>

          {/* 7 · Agent Work Status */}
          <WallboardCard
            title="Agent Work Status"
            period="Last Hour"
            icon={{ sprite: 'standard', symbol: 'work_capacity_limit' }}
            iconBg="#e8912a"
            comingSoon
          >
            <HBarChart data={m.workStatus} />
          </WallboardCard>

          {/* 8 · Work Performance */}
          <WallboardCard
            title="Work Performance"
            period="Last Hour"
            icon={{ sprite: 'standard', symbol: 'capacity_plan' }}
            iconBg="#0d9dda"
            comingSoon
          >
            <BigStat
              variant="grid"
              items={[
                { label: 'Average Work Handle Time', value: fmt(m.perf.avgWorkHandleSec) },
                { label: 'Average Speed to Answer', value: fmt(m.perf.avgSpeedToAnswerSec) },
                { label: 'Average Active Work Time', value: fmt(m.perf.avgActiveWorkSec) },
                { label: 'After Conversation Time', value: fmt(m.perf.afterConversationSec) },
              ]}
            />
          </WallboardCard>
        </div>
      </div>
    </PanelState>
  )
}
