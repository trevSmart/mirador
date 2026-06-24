import { useEffect, useState, type ReactNode } from 'react'
import { useMiradorData } from '../../api/mirador-data-context'
import { useDetailDrawer, type DetailTarget } from '../../detail/detail-drawer-context'
import { SfIcon } from '../ds'
import { AgentDetail } from './AgentDetail'
import { QueueDetail } from './QueueDetail'
import { SkillDetail } from './SkillDetail'

export function DetailDrawer() {
  const { detail, close } = useDetailDrawer()
  const { agents, queues, skills } = useMiradorData()

  const open = detail !== null
  // Retain the last target while closing so content doesn't blank out mid-animation.
  // Adjust derived state during render (React's recommended pattern) rather than
  // in an effect, so closing keeps the previous content until the slide-out ends.
  const [shown, setShown] = useState<DetailTarget | null>(detail)
  const [prevDetail, setPrevDetail] = useState<DetailTarget | null>(detail)
  if (detail !== prevDetail) {
    setPrevDetail(detail)
    if (detail) setShown(detail)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  let content: ReactNode = <p className="dd-empty">No s'ha trobat l'element.</p>
  if (shown?.kind === 'agent') {
    const agent = agents.find((a) => a.id === shown.id)
    if (agent) content = <AgentDetail agent={agent} />
  } else if (shown?.kind === 'queue') {
    const queue = queues.find((q) => q.id === shown.id)
    if (queue) content = <QueueDetail queue={queue} />
  } else if (shown?.kind === 'skill') {
    const skill = skills.find((s) => s.id === shown.id)
    if (skill) content = <SkillDetail skill={skill} />
  }

  return (
    <>
      <div
        className={`detail-backdrop${open ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`detail-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <button type="button" className="detail-drawer__close" onClick={close} aria-label="Tanca el detall">
          <SfIcon sprite="utility" symbol="close" size={16} />
        </button>
        <div className="detail-drawer__scroll">{content}</div>
      </aside>
    </>
  )
}
