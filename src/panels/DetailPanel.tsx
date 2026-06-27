import { useEffect, type ReactNode } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useAgents, useQueues, useSkills, useWork } from '../api/data-hooks'
import { AgentDetail } from '../components/detail/AgentDetail'
import { QueueDetail } from '../components/detail/QueueDetail'
import { SkillDetail } from '../components/detail/SkillDetail'
import { WorkItemDetail } from '../components/detail/WorkItemDetail'
import type { DetailPanelParams } from '../detail/detail-panel'
import { resolveDetailTitle } from '../detail/resolve-detail-meta'

export function DetailPanel({ api, params }: IDockviewPanelProps<DetailPanelParams>) {
  const agents = useAgents()
  const queues = useQueues()
  const skills = useSkills()
  const work = useWork()
  const target = { kind: params.kind, id: params.id }
  const title = resolveDetailTitle(target, { agents, queues, skills, work })

  useEffect(() => {
    if (api.title !== title) {
      api.setTitle(title)
    }
  }, [api, title])

  let content: ReactNode = <p className="dd-empty">No s&apos;ha trobat l&apos;element.</p>
  if (params.kind === 'agent') {
    const agent = agents.find((entry) => entry.id === params.id)
    if (agent) content = <AgentDetail agent={agent} />
  } else if (params.kind === 'queue') {
    const queue = queues.find((entry) => entry.id === params.id)
    if (queue) content = <QueueDetail queue={queue} />
  } else if (params.kind === 'skill') {
    const skill = skills.find((entry) => entry.id === params.id)
    if (skill) content = <SkillDetail skill={skill} />
  } else if (params.kind === 'work') {
    const item = work.find((entry) => entry.id === params.id)
    if (item) content = <WorkItemDetail item={item} />
  }

  return (
    <div className="panel-shell panel-shell--detail">
      <div className="detail-panel__body">{content}</div>
    </div>
  )
}
