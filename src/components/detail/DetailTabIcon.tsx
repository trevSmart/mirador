import { useAgents, useQueues, useSkills, useWork } from '../../api/data-hooks'
import type { DetailTarget } from '../../detail/detail-drawer-context'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AgentAvatar } from '../AgentRow'
import { SfIcon } from '../ds'

export function DetailTabIcon({ target }: { target: DetailTarget }) {
  const agents = useAgents()
  const queues = useQueues()
  const skills = useSkills()
  const work = useWork()

  if (target.kind === 'agent') {
    const agent = agents.find((entry) => entry.id === target.id)
    if (agent) {
      return <AgentAvatar id={agent.id} name={agent.name} photo={agent.photo} />
    }
    return <SfIcon sprite="standard" symbol="customers" sldsSize="x-small" />
  }

  if (target.kind === 'queue') {
    const queue = queues.find((entry) => entry.id === target.id)
    return <SfIcon name="queue" sldsSize="x-small" recordId={queue?.id} />
  }

  if (target.kind === 'work') {
    const item = work.find((entry) => entry.id === target.id)
    if (item) {
      const icon = resolveWorkItemIcon(item)
      return <SfIcon sprite={icon.sprite} symbol={icon.symbol} sldsSize="x-small" recordId={item.id} />
    }
    return <SfIcon name="work" sldsSize="x-small" />
  }

  const skill = skills.find((entry) => entry.id === target.id)
  return <SfIcon name="skill" sldsSize="x-small" recordId={skill?.id} />
}
