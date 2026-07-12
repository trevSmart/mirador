/* Detail drawer — provider component.
   Any item (agent/queue/skill row, search result, cross-link inside the drawer)
   calls one of the open* methods; a single <DetailDrawer> mounted at the app
   root renders the matching content. Opening also records the item as "recent"
   so it shows up in global search.

   The context + useDetailDrawer hook live in ./detail-drawer-context (kept out
   of this component file so Fast Refresh works). */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { useAgents, useQueues, useSkills, useWork } from '../api/data-hooks'
import { appNavigator } from '../navigation/app-navigator'
import { recordDetailOpen } from '../utils/detail-recent-store'
import { resolveDetailTitle } from './resolve-detail-meta'
import {
  DetailDrawerContext,
  type DetailDrawerContextValue,
  type DetailKind,
  type DetailNavDirection,
  type DetailTarget,
} from './detail-drawer-context'
import { useRegisterModal } from '../modals/useRegisterModal'

export function DetailDrawerProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  // Drilldown history, browser-style: every open while the drawer is already
  // showing another record pushes the outgoing target onto `stack`; going back
  // moves the current one onto `forwardStack` so it can be revisited, and any
  // fresh open discards the forward branch.
  const [stack, setStack] = useState<DetailTarget[]>([])
  const [forwardStack, setForwardStack] = useState<DetailTarget[]>([])
  // Cap on va l'última navegació: el drawer orienta el cross-slide amb això
  // (enrere llisca en direcció contrària perquè es llegeixi com a retorn).
  const [navDirection, setNavDirection] = useState<DetailNavDirection>('forward')

  // Registra l'estat obert al registre de modals (obert quan detail !== null)
  useRegisterModal('detail-drawer', detail !== null)
  const agents = useAgents()
  const queues = useQueues()
  const skills = useSkills()
  const work = useWork()

  const open = useCallback(
    (kind: DetailKind, id: string) => {
      if (detail && detail.kind === kind && detail.id === id) return
      devLog.action('detail:open', `${kind} ${id}`)
      recordDetailOpen({ kind, id })
      if (detail) setStack((prev) => [...prev, detail])
      setForwardStack([])
      setNavDirection('forward')
      setDetail({ kind, id })
    },
    [detail],
  )

  const back = useCallback(() => {
    const target = stack[stack.length - 1]
    if (!target || !detail) return
    devLog.action('detail:back', `${target.kind} ${target.id}`)
    setStack((prev) => prev.slice(0, -1))
    setForwardStack((prev) => [...prev, detail])
    setNavDirection('back')
    setDetail(target)
  }, [stack, detail])

  const forward = useCallback(() => {
    const target = forwardStack[forwardStack.length - 1]
    if (!target || !detail) return
    devLog.action('detail:forward', `${target.kind} ${target.id}`)
    setForwardStack((prev) => prev.slice(0, -1))
    setStack((prev) => [...prev, detail])
    setNavDirection('forward')
    setDetail(target)
  }, [forwardStack, detail])

  const openAsTab = useCallback(
    (target: DetailTarget) => {
      const title = resolveDetailTitle(target, { agents, queues, skills, work })
      devLog.action('detail:open-as-tab', `${target.kind} · ${title}`)
      recordDetailOpen({ kind: target.kind, id: target.id, name: title })
      // Només tanca el drawer si la pestanya s'ha obert de debò: si el
      // navegador encara no té dockview connectat, openDetail és un no-op i
      // mantenim el drawer perquè l'usuari no perdi el context.
      if (appNavigator.openDetail(target, title)) {
        setDetail(null)
        setStack([])
        setForwardStack([])
      }
    },
    [agents, queues, skills, work],
  )

  const value = useMemo<DetailDrawerContextValue>(
    () => ({
      detail,
      openAgent: (id) => open('agent', id),
      openQueue: (id) => open('queue', id),
      openSkill: (id) => open('skill', id),
      openWork: (id) => open('work', id),
      openAsTab,
      close: () => {
        setDetail(null)
        setStack([])
        setForwardStack([])
      },
      back,
      canGoBack: stack.length > 0,
      forward,
      canGoForward: forwardStack.length > 0,
      navDirection,
    }),
    [detail, open, openAsTab, back, stack, forward, forwardStack, navDirection],
  )

  return <DetailDrawerContext.Provider value={value}>{children}</DetailDrawerContext.Provider>
}
