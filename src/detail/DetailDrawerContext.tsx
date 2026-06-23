/* Detail drawer — global open/close state.
   Any item (agent/queue/skill row, search result, cross-link inside the drawer)
   calls one of the open* methods; a single <DetailDrawer> mounted at the app
   root renders the matching content. Opening also records the item as "recent"
   so it shows up in global search. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { recordDetailOpen } from '../utils/detail-recent-store'

export type DetailKind = 'agent' | 'queue' | 'skill'

export interface DetailTarget {
  kind: DetailKind
  id: string
}

interface DetailDrawerContextValue {
  detail: DetailTarget | null
  openAgent: (id: string) => void
  openQueue: (id: string) => void
  openSkill: (id: string) => void
  close: () => void
}

const DetailDrawerContext = createContext<DetailDrawerContextValue | null>(null)

export function DetailDrawerProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<DetailTarget | null>(null)

  const open = useCallback((kind: DetailKind, id: string) => {
    recordDetailOpen({ kind, id })
    setDetail({ kind, id })
  }, [])

  const value = useMemo<DetailDrawerContextValue>(
    () => ({
      detail,
      openAgent: (id) => open('agent', id),
      openQueue: (id) => open('queue', id),
      openSkill: (id) => open('skill', id),
      close: () => setDetail(null),
    }),
    [detail, open],
  )

  return <DetailDrawerContext.Provider value={value}>{children}</DetailDrawerContext.Provider>
}

export function useDetailDrawer(): DetailDrawerContextValue {
  const ctx = useContext(DetailDrawerContext)
  if (!ctx) {
    throw new Error('useDetailDrawer must be used within DetailDrawerProvider')
  }
  return ctx
}
