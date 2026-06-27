/* Detail drawer — provider component.
   Any item (agent/queue/skill row, search result, cross-link inside the drawer)
   calls one of the open* methods; a single <DetailDrawer> mounted at the app
   root renders the matching content. Opening also records the item as "recent"
   so it shows up in global search.

   The context + useDetailDrawer hook live in ./detail-drawer-context (kept out
   of this component file so Fast Refresh works). */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { useMiradorData } from '../api/mirador-data-context'
import { useDockviewHost } from '../dockview/dockview-host-context'
import { openDetailTab } from '../panels/detail-tab-actions'
import { recordDetailOpen } from '../utils/detail-recent-store'
import { resolveDetailTitle } from './resolve-detail-meta'
import {
  DetailDrawerContext,
  type DetailDrawerContextValue,
  type DetailKind,
  type DetailTarget,
} from './detail-drawer-context'

export function DetailDrawerProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const { agents, queues, skills, work } = useMiradorData()
  const { getApi } = useDockviewHost()

  const open = useCallback((kind: DetailKind, id: string) => {
    devLog.action('detail:open', `${kind} ${id}`)
    recordDetailOpen({ kind, id })
    setDetail({ kind, id })
  }, [])

  const openAsTab = useCallback(
    (target: DetailTarget) => {
      const api = getApi()
      if (!api) {
        return
      }
      const title = resolveDetailTitle(target, { agents, queues, skills, work })
      devLog.action('detail:open-as-tab', `${target.kind} · ${title}`)
      recordDetailOpen({ kind: target.kind, id: target.id, name: title })
      openDetailTab(api, target, title)
      setDetail(null)
    },
    [agents, getApi, queues, skills, work],
  )

  const value = useMemo<DetailDrawerContextValue>(
    () => ({
      detail,
      openAgent: (id) => open('agent', id),
      openQueue: (id) => open('queue', id),
      openSkill: (id) => open('skill', id),
      openWork: (id) => open('work', id),
      openAsTab,
      close: () => setDetail(null),
    }),
    [detail, open, openAsTab],
  )

  return <DetailDrawerContext.Provider value={value}>{children}</DetailDrawerContext.Provider>
}
