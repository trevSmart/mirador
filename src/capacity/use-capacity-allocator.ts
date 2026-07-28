import { useCallback, useMemo, useState } from 'react'
import {
  computeDynRanges,
  computeHardRanges,
  moveTo as engineMoveTo,
  sum,
} from './allocator-engine'
import type {
  AllocatorInput,
  DynRange,
  HardRange,
} from './allocator-types'

export type UseCapacityAllocatorArgs = AllocatorInput & {
  /** Pre-lock this queue when the panel opens (session-scoped). */
  focusQueueId?: string
}

export type UseCapacityAllocatorResult = {
  allocation: number[]
  locked: boolean[]
  setAllocation: (next: number[]) => void
  setLocked: (next: boolean[]) => void
  toggleLock: (index: number) => void
  moveTo: (queueIndex: number, target: number) => void
  hard: HardRange[]
  dyn: DynRange[]
  baseline: number[]
  isDirty: boolean
  deltas: number[]
  interacting: boolean
  beginInteraction: () => void
  endInteraction: () => void
  interactionBaseline: number[]
  reset: () => void
}

function initialLocked(queues: AllocatorInput['queues'], focusQueueId?: string): boolean[] {
  if (!focusQueueId) return queues.map(() => false)
  return queues.map((q) => q.id === focusQueueId)
}

/**
 * Local simulation state for the capacity allocator.
 * Never fetches and never writes — the panel owns Apply/Reset wiring.
 */
export function useCapacityAllocator(args: UseCapacityAllocatorArgs): UseCapacityAllocatorResult {
  const { queues, profiles, total, current, focusQueueId } = args
  const nQ = queues.length

  // Snapshot identity: when the live input changes shape or baseline, re-seed.
  const inputKey = useMemo(
    () =>
      `${total}|${queues.map((q) => q.id).join(',')}|${current.join(',')}|${focusQueueId ?? ''}`,
    [total, queues, current, focusQueueId],
  )

  const [seedKey, setSeedKey] = useState(inputKey)
  const [allocation, setAllocationState] = useState(() => current.slice())
  const [locked, setLockedState] = useState(() => initialLocked(queues, focusQueueId))
  const [baseline, setBaseline] = useState(() => current.slice())
  const [interacting, setInteracting] = useState(false)
  const [interactionBaseline, setInteractionBaseline] = useState(() => current.slice())

  if (inputKey !== seedKey) {
    setSeedKey(inputKey)
    setAllocationState(current.slice())
    setLockedState(initialLocked(queues, focusQueueId))
    setBaseline(current.slice())
    setInteracting(false)
    setInteractionBaseline(current.slice())
  }

  const hard = useMemo(
    () => (nQ === 0 ? [] : computeHardRanges(profiles, total, nQ)),
    [profiles, total, nQ],
  )

  const dyn = useMemo(
    () => (nQ === 0 ? [] : computeDynRanges(allocation, locked, profiles, total)),
    [allocation, locked, profiles, total, nQ],
  )

  const deltas = useMemo(
    () => allocation.map((v, i) => v - baseline[i]),
    [allocation, baseline],
  )

  const isDirty = useMemo(
    () => deltas.some((d) => d !== 0),
    [deltas],
  )

  const setAllocation = useCallback((next: number[]) => {
    if (next.length !== nQ) return
    if (sum(next) !== total) return
    if (next.some((v) => !Number.isInteger(v) || v < 0)) return
    setAllocationState(next.slice())
  }, [nQ, total])

  const setLocked = useCallback((next: boolean[]) => {
    if (next.length !== nQ) return
    setLockedState(next.slice())
  }, [nQ])

  const toggleLock = useCallback((index: number) => {
    setLockedState((prev) => {
      const next = prev.slice()
      next[index] = !next[index]
      return next
    })
  }, [])

  const moveTo = useCallback(
    (queueIndex: number, target: number) => {
      setAllocationState((prev) =>
        engineMoveTo(prev, queueIndex, target, locked, profiles, total),
      )
    },
    [locked, profiles, total],
  )

  const beginInteraction = useCallback(() => {
    setInteracting(true)
    setInteractionBaseline(allocation.slice())
  }, [allocation])

  const endInteraction = useCallback(() => {
    setInteracting(false)
  }, [])

  const reset = useCallback(() => {
    setAllocationState(baseline.slice())
    setInteracting(false)
    setInteractionBaseline(baseline.slice())
  }, [baseline])

  return {
    allocation,
    locked,
    setAllocation,
    setLocked,
    toggleLock,
    moveTo,
    hard,
    dyn,
    baseline,
    isDirty,
    deltas,
    interacting,
    beginInteraction,
    endInteraction,
    interactionBaseline,
    reset,
  }
}
