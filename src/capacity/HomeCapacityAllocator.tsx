import { useMemo } from 'react'
import { useAgents, useQueues } from '../api/data-hooks'
import { Button } from '../components/ds'
import { CapacityAllocator } from './CapacityAllocator'
import { buildAllocatorInput } from './build-allocator-input'
import { useCapacityAllocator } from './use-capacity-allocator'

/**
 * The capacity allocator embedded at the top of Home's Queues section.
 *
 * Same simulation as the Capacity panel (local state only, nothing is written
 * back), trimmed to what fits a side column: no focus-queue param and no Apply
 * action — just the chart plus a Reset once the simulation diverges from the
 * live staffing.
 */
export function HomeCapacityAllocator() {
  const agents = useAgents()
  const queues = useQueues()

  const input = useMemo(() => buildAllocatorInput(agents, queues), [agents, queues])
  const { allocation, locked, setAllocation, setLocked, isDirty, reset } =
    useCapacityAllocator(input)

  if (queues.length === 0 || input.total === 0) {
    return (
      <p className="panel-section__empty">
        {queues.length === 0
          ? 'No hi ha cues configurades.'
          : 'No hi ha agents en línia per assignar.'}
      </p>
    )
  }

  return (
    <div className="home-capacity">
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
        <div className="home-capacity__actions">
          <Button variant="ghost" size="sm" onClick={reset}>
            Restableix
          </Button>
        </div>
      )}
    </div>
  )
}
