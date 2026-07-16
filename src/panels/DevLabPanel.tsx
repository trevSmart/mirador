/* ──────────────────────────────────────────────────────────────────────────
   Dev Lab — panell de proves per a experiments de desenvolupament.
   ────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from 'react'
import {
  DEMO_FLOW_AGENTS,
  DEMO_FLOW_AGENTS_STRESS,
  DEMO_QUEUE_NAMES,
  DEMO_REDIRECTS,
  DEMO_REDIRECTS_STRESS,
} from '../components/dev/demo-flow-agent'
import {
  EChartsQueueFlow,
  type QueueFlowPulseMode,
} from '../components/dev/EChartsQueueFlow'
import { SegmentedField } from '../components/settings/parts'

const PULSE_MODE_OPTIONS: Array<{ value: QueueFlowPulseMode; label: string }> = [
  { value: 'per-strand', label: 'SVG · per fil' },
  { value: 'per-bundle', label: 'SVG · barra' },
  { value: 'canvas', label: 'Canvas · barra' },
]

export function DevLabPanel() {
  const [pulseMode, setPulseMode] = useState<QueueFlowPulseMode>('per-strand')
  const stress = pulseMode !== 'per-strand'
  const agents = stress ? DEMO_FLOW_AGENTS_STRESS : DEMO_FLOW_AGENTS
  const redirects = stress ? DEMO_REDIRECTS_STRESS : DEMO_REDIRECTS
  const used = useMemo(() => agents.reduce((s, a) => s + a.used, 0), [agents])
  const subtitle = useMemo(
    () =>
      stress
        ? `${used} items assignats · pols moderat (2,2 s)`
        : `${used} items assignats · pols per fil (densitat mitjana-alta)`,
    [used, stress],
  )

  return (
    <div className="dev-lab">
      <div className="dev-lab-compare dev-lab-compare--fill">
        <div className="dev-lab-compare__header">
          <div>
            <p className="dev-lab-compare__label">
              Flux cua → agent — Apache ECharts (2 agents de demo, fan-out)
            </p>
            <p className="dev-lab-note">{subtitle}</p>
          </div>
          <SegmentedField
            label="Animació dels polsos"
            value={pulseMode}
            onChange={setPulseMode}
            options={PULSE_MODE_OPTIONS}
          />
        </div>
        <EChartsQueueFlow
          agents={agents}
          redirects={redirects}
          queueNames={DEMO_QUEUE_NAMES}
          pulseMode={pulseMode}
        />
      </div>
    </div>
  )
}
