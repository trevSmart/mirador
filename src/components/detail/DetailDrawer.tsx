import { useEffect, useState, type ReactNode } from 'react'
import { useAgents, useQueues, useSkills, useWork } from '../../api/data-hooks'
import { useDetailDrawer, type DetailTarget } from '../../detail/detail-drawer-context'
import { AppIcon } from '../ds'
import { AgentDetail } from './AgentDetail'
import { QueueDetail } from './QueueDetail'
import { SkillDetail } from './SkillDetail'
import { WorkItemDetail } from './WorkItemDetail'

export function DetailDrawer() {
  const { detail, close, openAsTab } = useDetailDrawer()
  const agents = useAgents()
  const queues = useQueues()
  const skills = useSkills()
  const work = useWork()

  const open = detail !== null
  // Retain the last target while closing so content doesn't blank out mid-animation.
  // Adjust derived state during render (React's recommended pattern) rather than
  // in an effect, so closing keeps the previous content until the slide-out ends.
  const [shown, setShown] = useState<DetailTarget | null>(detail)
  const [prevDetail, setPrevDetail] = useState<DetailTarget | null>(detail)
  // When navigating between records with the drawer already open, keep the
  // outgoing record mounted underneath while the incoming one slides in over
  // it, so the panel never shows an empty gap mid-transition. `leaving` holds
  // the previous target during that overlap; it's cleared when the slide ends.
  const [leaving, setLeaving] = useState<DetailTarget | null>(null)
  if (detail !== prevDetail) {
    const isNav = detail != null && prevDetail != null && shown != null
    setLeaving(isNav ? shown : null)
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

  function renderContent(target: DetailTarget | null): ReactNode {
    if (target?.kind === 'agent') {
      const agent = agents.find((a) => a.id === target.id)
      if (agent) return <AgentDetail agent={agent} />
    } else if (target?.kind === 'queue') {
      const queue = queues.find((q) => q.id === target.id)
      if (queue) return <QueueDetail queue={queue} />
    } else if (target?.kind === 'skill') {
      const skill = skills.find((s) => s.id === target.id)
      if (skill) return <SkillDetail skill={skill} />
    } else if (target?.kind === 'work') {
      const item = work.find((w) => w.id === target.id)
      if (item) return <WorkItemDetail item={item} />
    }
    return <p className="dd-empty">No s'ha trobat l'element.</p>
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
        <div className="detail-drawer__toolbar">
          <button
            type="button"
            className="detail-drawer__icon-btn"
            onClick={() => shown && openAsTab(shown)}
            disabled={!shown}
            aria-label="Obre com a pestanya"
            title="Obre com a pestanya"
          >
            <AppIcon name="expand_alt" size={16} />
          </button>
          <button type="button" className="detail-drawer__icon-btn" onClick={close} aria-label="Tanca el detall">
            <AppIcon name="close" size={16} />
          </button>
        </div>
        <div className="detail-drawer__scroll">
          {leaving && (
            <div key={`${leaving.kind}:${leaving.id}`} className="detail-drawer__content--leaving" aria-hidden="true">
              {renderContent(leaving)}
            </div>
          )}
          <div
            key={shown ? `${shown.kind}:${shown.id}` : 'empty'}
            className={leaving ? 'detail-drawer__content--nav' : undefined}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setLeaving(null)
            }}
          >
            {renderContent(shown)}
          </div>
        </div>
      </aside>
    </>
  )
}
