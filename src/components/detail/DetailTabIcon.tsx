import type { DetailTarget } from '../../detail/detail-drawer-context'
import { useDetailEntity } from '../../detail/use-detail-entity'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AgentAvatar } from '../AgentRow'
import { SfIcon } from '../ds'

export function DetailTabIcon({ target }: { target: DetailTarget }) {
  const { entity } = useDetailEntity(target)

  if (target.kind === 'agent') {
    if (entity?.kind === 'agent') {
      const agent = entity.data
      return <AgentAvatar id={agent.id} name={agent.name} photo={agent.photo} />
    }
    return <SfIcon sprite="standard" symbol="customers" sldsSize="x-small" />
  }

  if (target.kind === 'queue') {
    const queue = entity?.kind === 'queue' ? entity.data : null
    return <SfIcon name="queue" sldsSize="x-small" recordId={queue?.id} />
  }

  if (target.kind === 'work') {
    if (entity?.kind === 'work') {
      const item = entity.data
      const icon = resolveWorkItemIcon(item)
      return <SfIcon sprite={icon.sprite} symbol={icon.symbol} sldsSize="x-small" recordId={item.id} />
    }
    return <SfIcon name="work" sldsSize="x-small" />
  }

  const skill = entity?.kind === 'skill' ? entity.data : null
  return <SfIcon name="skill" sldsSize="x-small" recordId={skill?.id} />
}
