import { useMiradorData } from '../../api/mirador-data-context'
import type { WorkItem } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { channelLabel, formatSeconds, workStatusLabel } from '../../utils/format'
import { objectLabel, resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { Badge, FadeValue, SfIcon } from '../ds'
import { DetailRow, DrawerSection, EmptyHint, MiniAgentRow, Stat, StatGrid } from './parts'

/* Generic work-item detail. Shows what the global /work snapshot already gives
   us (subject, channel, status, age, backing SObject, related agent/queue).
   A type-specific endpoint per SObject (VoiceCall, Case, …) will enrich this
   later — see the placeholder section below. */
export function WorkItemDetail({ item }: { item: WorkItem }) {
  const { agents, queues } = useMiradorData()
  const { openAgent, openQueue } = useDetailDrawer()

  const icon = resolveWorkItemIcon(item)
  const agent = item.agentId ? agents.find((a) => a.id === item.agentId) : undefined
  const queue = item.queueId ? queues.find((q) => q.id === item.queueId) : undefined

  return (
    <>
      <header className="dd-head">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={56} bg={icon.tint} />
        <div className="dd-head__id">
          <h2 className="dd-head__name">{item.subject}</h2>
          <span className="dd-head__sub">{objectLabel(item)}</span>
          <Badge tone="neutral">{workStatusLabel(item.status)}</Badge>
        </div>
      </header>

      <DrawerSection title="Resum">
        <StatGrid>
          <Stat label="Canal" value={channelLabel(item.channelKey)} />
          <Stat label="Estat" value={workStatusLabel(item.status)} />
          <Stat label="Edat" value={<FadeValue value={formatSeconds(item.ageSec)} />} />
          <Stat label="Tipus d'objecte" value={objectLabel(item)} />
        </StatGrid>
      </DrawerSection>

      <DrawerSection title="Relacionats">
        {agent || queue ? (
          <div className="dd-list">
            {agent ? <MiniAgentRow agent={agent} onClick={() => openAgent(agent.id)} /> : null}
            {queue ? (
              <DetailRow
                leading={<SfIcon name="queue" sldsSize="small" bg={queue.color} />}
                title={queue.name}
                meta="Cua"
                onClick={() => openQueue(queue.id)}
              />
            ) : null}
          </div>
        ) : (
          <EmptyHint>Sense agent ni cua associats.</EmptyHint>
        )}
      </DrawerSection>

      <DrawerSection title="Detalls">
        <EmptyHint>Els detalls específics d&apos;aquest objecte s&apos;afegiran properament.</EmptyHint>
      </DrawerSection>
    </>
  )
}
