import type { ReactNode } from 'react'
import type { Agent } from '../../api/types'
import { devLog } from '../../dev/dev-log'
import { colorFromRecordId } from '../../utils/color-from-string'
import { AgentAvatar } from '../AgentRow'
import { AppIcon } from '../ds/AppIcon'
import type { AppIconName } from '../ds/app-icon-names.generated'
import { Button } from '../ds/Button'
import { FadeValue } from '../ds/FadeValue'
import { StatusBadge } from '../StatusBadge'

type StatTone = 'ok' | 'watch' | 'alert'

export interface DrawerAction {
  label: string
  icon: AppIconName
  primary?: boolean
  onClick?: () => void
}

/** Action row under the drawer hero: the operations a supervisor can start on
    the object being inspected (one primary + secondaries). Actions without a
    handler yet log a dev action so the click is at least observable. */
export function DrawerActions({ actions }: { actions: DrawerAction[] }) {
  if (actions.length === 0) return null
  return (
    <div className="dd-actions">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.primary ? 'primary' : 'subtle'}
          size="sm"
          icon={<AppIcon name={action.icon} size={15} />}
          onClick={action.onClick ?? (() => devLog.action(`drawer:${action.label} (pendent d'implementar)`))}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

export function DrawerSection({
  title,
  children,
  compact,
}: {
  title: ReactNode
  children: ReactNode
  /** En el layout de pestanya gran, les seccions compactes poden compartir fila. */
  compact?: boolean
}) {
  return (
    <section className={['dd-section', compact ? 'dd-section--compact' : ''].filter(Boolean).join(' ')}>
      <h4 className="dd-section__title">{title}</h4>
      {children}
    </section>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="dd-stats">{children}</div>
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: StatTone }) {
  const toneAttr = tone ?? 'none'
  const animated =
    typeof value === 'string' || typeof value === 'number' ? (
      <FadeValue className="dd-stat__value" data-tone={toneAttr} value={value} />
    ) : (
      <span className="dd-stat__value" data-tone={toneAttr}>
        {value}
      </span>
    )

  return (
    <div className="dd-stat">
      {animated}
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
  recordId,
  meta,
  trailing,
  onClick,
}: {
  leading: ReactNode
  title: ReactNode
  /** ID del registre: acoloreix el nom amb el color derivat, com a les llistes. */
  recordId?: string | null
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
}) {
  const content = (
    <>
      {leading}
      <span className="dd-row__body">
        <span
          className="dd-row__name"
          style={recordId ? { color: colorFromRecordId(recordId) } : undefined}
        >
          {title}
        </span>
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
      leading={<AgentAvatar id={agent.id} name={agent.name} photo={agent.photo} />}
      title={agent.name}
      meta={agent.role}
      trailing={<StatusBadge status={agent.status} />}
      onClick={onClick}
    />
  )
}
