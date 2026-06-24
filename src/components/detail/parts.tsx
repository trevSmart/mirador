import type { ReactNode } from 'react'
import type { Agent } from '../../api/types'
import { AgentAvatar } from '../AgentRow'
import { StatusBadge } from '../StatusBadge'

type StatTone = 'ok' | 'watch' | 'alert'

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dd-section">
      <h4 className="dd-section__title">{title}</h4>
      {children}
    </section>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="dd-stats">{children}</div>
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: StatTone }) {
  return (
    <div className="dd-stat">
      <span className="dd-stat__value" data-tone={tone ?? 'none'}>
        {value}
      </span>
      <span className="dd-stat__label">{label}</span>
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="dd-empty">{children}</p>
}

export function DetailRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
}: {
  leading: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}) {
  const content = (
    <>
      {leading}
      <span className="dd-row__body">
        <span className="dd-row__name">{title}</span>
        {meta ? <span className="dd-row__meta">{meta}</span> : null}
      </span>
      {trailing}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="dd-row dd-row--clickable" onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className="dd-row">{content}</div>
}

export function MiniAgentRow({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  return (
    <DetailRow
      leading={<AgentAvatar name={agent.name} photo={agent.photo} />}
      title={agent.name}
      meta={agent.role}
      trailing={<StatusBadge status={agent.status} />}
      onClick={onClick}
    />
  )
}
