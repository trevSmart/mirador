/* Detail drawer — context + hook (no components, so Fast Refresh stays happy).
   The <DetailDrawerProvider> lives in DetailDrawerContext.tsx and supplies this
   context's value. */

import { createContext, useContext } from 'react'

export type DetailKind = 'agent' | 'queue' | 'skill' | 'work'

export interface DetailTarget {
  kind: DetailKind
  id: string
}

export interface DetailDrawerContextValue {
  detail: DetailTarget | null
  openAgent: (id: string) => void
  openQueue: (id: string) => void
  openSkill: (id: string) => void
  openWork: (id: string) => void
  openAsTab: (target: DetailTarget) => void
  close: () => void
}

export const DetailDrawerContext = createContext<DetailDrawerContextValue | null>(null)

export function useDetailDrawer(): DetailDrawerContextValue {
  const ctx = useContext(DetailDrawerContext)
  if (!ctx) {
    throw new Error('useDetailDrawer must be used within DetailDrawerProvider')
  }
  return ctx
}
