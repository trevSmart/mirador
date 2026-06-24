/* Mirador data — context + hook (no components, for Fast Refresh).
   The <MiradorDataProvider> in MiradorDataProvider.tsx supplies this value.
   Only holds domain data arrays; fetch status lives in mirador-status-context. */

import { createContext, useContext } from 'react'
import type { Agent, Queue, Skill, WorkItem } from './types'

export interface MiradorDataContextValue {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
}

export const MiradorDataContext = createContext<MiradorDataContextValue | null>(null)

export function useMiradorData(): MiradorDataContextValue {
  const context = useContext(MiradorDataContext)
  if (!context) {
    throw new Error('useMiradorData must be used within MiradorDataProvider')
  }
  return context
}
