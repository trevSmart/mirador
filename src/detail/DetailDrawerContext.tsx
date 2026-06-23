/* Detail drawer — provider component.
   Any item (agent/queue/skill row, search result, cross-link inside the drawer)
   calls one of the open* methods; a single <DetailDrawer> mounted at the app
   root renders the matching content. Opening also records the item as "recent"
   so it shows up in global search.

   The context + useDetailDrawer hook live in ./detail-drawer-context (kept out
   of this component file so Fast Refresh works). */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { recordDetailOpen } from '../utils/detail-recent-store'
import {
  DetailDrawerContext,
  type DetailDrawerContextValue,
  type DetailKind,
  type DetailTarget,
} from './detail-drawer-context'

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
