import { useMemo, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useAgents, useDataStatus, useQueues } from '../api/data-hooks'
import { CapacityAllocator } from '../capacity/CapacityAllocator'
import { buildAllocatorInput } from '../capacity/build-allocator-input'
import { useCapacityAllocator } from '../capacity/use-capacity-allocator'
import { Button } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { parseCapacityPanelParams } from './capacity-panel-params'

export function CapacityPanel({ params }: IDockviewPanelProps) {
  const agents = useAgents()
  const queues = useQueues()
  const { isLoading, error, refresh } = useDataStatus()

  const incoming = parseCapacityPanelParams(params)
  const [focusQueueId, setFocusQueueId] = useState(incoming?.focusQueueId)
  const [prevRevision, setPrevRevision] = useState(incoming?.revision)
  if (incoming && incoming.revision !== prevRevision) {
    setPrevRevision(incoming.revision)
    setFocusQueueId(incoming.focusQueueId)
  }

  const input = useMemo(() => buildAllocatorInput(agents, queues), [agents, queues])

  const {
    allocation,
    locked,
    setAllocation,
    setLocked,
    isDirty,
    deltas,
    reset,
  } = useCapacityAllocator({ ...input, focusQueueId })

  const deltaSummary = useMemo(() => {
    const parts: string[] = []
    for (let i = 0; i < input.queues.length; i++) {
      const d = deltas[i]
      if (d === 0) continue
      parts.push(`${input.queues[i].name} ${d > 0 ? '+' : ''}${d}`)
    }
    return parts.join(' · ')
  }, [deltas, input.queues])

  const isEmpty = queues.length === 0 || input.total === 0

  return (
    <PanelState
      shellClassName="panel-shell--capacity"
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={isEmpty}
      emptyMessage={
        queues.length === 0
          ? 'No hi ha cues configurades.'
          : 'No hi ha agents en línia per assignar.'
      }
    >
      <div className="capacity-panel">
        <CapacityAllocator
          queues={input.queues}
          profiles={input.profiles}
          total={input.total}
          value={allocation}
          onChange={setAllocation}
          locked={locked}
          onLockedChange={setLocked}
          defaultView="areas"
          defaultPerQueueScale
        />

        {isDirty && (
          <footer className="capacity-panel__footer">
            <span className="capacity-panel__diff">{deltaSummary}</span>
            <div className="capacity-panel__actions">
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled
                title="Coming soon — queue membership API not wired yet"
              >
                Apply changes
              </Button>
            </div>
          </footer>
        )}
      </div>
    </PanelState>
  )
}
