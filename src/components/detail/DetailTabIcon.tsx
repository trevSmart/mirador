import { useMiradorData } from '../../api/mirador-data-context'
import type { DetailTarget } from '../../detail/detail-drawer-context'
import { colorFromString } from '../../utils/color-from-string'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AgentAvatar } from '../AgentRow'
import { SfIcon } from '../ds'

export function DetailTabIcon({ target }: { target: DetailTarget }) {
  const { agents, queues, skills, work } = useMiradorData()

  if (target.kind === 'agent') {
    const agent = agents.find((entry) => entry.id === target.id)
    if (agent) {
      return <AgentAvatar name={agent.name} photo={agent.photo} />
    }
    return <SfIcon sprite="standard" symbol="customers" sldsSize="x-small" />
  }

  if (target.kind === 'queue') {
    const queue = queues.find((entry) => entry.id === target.id)
    return <SfIcon name="queue" sldsSize="x-small" bg={queue?.color} />
  }

  if (target.kind === 'work') {
    const item = work.find((entry) => entry.id === target.id)
    if (item) {
      const icon = resolveWorkItemIcon(item)
      return <SfIcon sprite={icon.sprite} symbol={icon.symbol} sldsSize="x-small" bg={icon.tint} />
    }
    return <SfIcon name="work" sldsSize="x-small" />
  }

  const skill = skills.find((entry) => entry.id === target.id)
  return <SfIcon name="skill" sldsSize="x-small" bg={skill ? colorFromString(skill.name) : undefined} />
}
