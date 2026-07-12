import { useEffect, type ReactNode } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { PanelShell } from '../components/PanelState'
import { AgentDetail } from '../components/detail/AgentDetail'
import { QueueDetail } from '../components/detail/QueueDetail'
import { SkillDetail } from '../components/detail/SkillDetail'
import { WorkItemDetail } from '../components/detail/WorkItemDetail'
import type { DetailPanelParams } from '../detail/detail-panel'
import { detailTitleOf } from '../detail/resolve-detail-meta'
import { useDetailEntity } from '../detail/use-detail-entity'

export function DetailPanel({ api, params }: IDockviewPanelProps<DetailPanelParams>) {
  const target = { kind: params.kind, id: params.id }
  const { entity } = useDetailEntity(target)
  const title = detailTitleOf(entity, params.kind)

  useEffect(() => {
    if (api.title !== title) {
      api.setTitle(title)
    }
  }, [api, title])

  let content: ReactNode = <p className="dd-empty">No s&apos;ha trobat l&apos;element.</p>
  if (entity?.kind === 'agent') {
    content = <AgentDetail agent={entity.data} />
  } else if (entity?.kind === 'queue') {
    content = <QueueDetail queue={entity.data} />
  } else if (entity?.kind === 'skill') {
    content = <SkillDetail skill={entity.data} />
  } else if (entity?.kind === 'work') {
    content = <WorkItemDetail item={entity.data} />
  }

  return (
    <PanelShell hideHeader className="panel-shell--detail">
      <div className="detail-panel__body">{content}</div>
    </PanelShell>
  )
}
