/* Mirador data — context + hook (no components, for Fast Refresh).
   The <MiradorDataProvider> in MiradorDataProvider.tsx supplies this value. */

import { createContext, useContext } from 'react'
import type { Agent, Queue, Skill, WorkItem } from './types'

export interface RefreshOptions {
  silent?: boolean
}

export interface MiradorDataContextValue {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: (options?: RefreshOptions) => Promise<void>
}

export const MiradorDataContext = createContext<MiradorDataContextValue | null>(null)

export function useMiradorData(): MiradorDataContextValue {
  const context = useContext(MiradorDataContext)
  if (!context) {
    throw new Error('useMiradorData must be used within MiradorDataProvider')
  }
  return context
}
