import { useSyncExternalStore } from 'react'

let seatedAgentIds = new Set<string>()
const listeners = new Set<() => void>()

export function setSpaceSeatedAgentIds(ids: Set<string>): void {
  seatedAgentIds = ids
  for (const listener of listeners) listener()
}

export function useSpaceSeatedAgentIds(): Set<string> {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => seatedAgentIds,
    () => seatedAgentIds,
  )
}
