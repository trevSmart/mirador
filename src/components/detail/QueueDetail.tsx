import { useAgents, useWork } from '../../api/data-hooks'
import type { Queue } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { sortAgentsByPresence } from '../../utils/agent-stats'
import { colorFromRecordId } from '../../utils/color-from-string'
import { channelLabel, formatSeconds } from '../../utils/format'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { Badge, FadeValue, SfIcon } from '../ds'
import { DetailRow, DrawerSection, EmptyHint, MiniAgentRow, Stat, StatGrid } from './parts'

export function QueueDetail({ queue }: { queue: Queue }) {
  const agents = useAgents()
  const work = useWork()
  const { openAgent, openWork } = useDetailDrawer()

  const waiting = work.filter((item) => item.status === 'queued' && item.queueId === queue.id)
  const members = sortAgentsByPresence(agents.filter((agent) => agent.queueIds.includes(queue.id)))

  return (
    <>
      <header className="dd-head">
        <SfIcon name="queue" size={40} bg={colorFromRecordId(queue.id)} />
        <div className="dd-head__id">
          <h2 className="dd-head__name" style={{ color: colorFromRecordId(queue.id) }}>
            {queue.name}
          </h2>
          <span className="dd-head__sub">Cua</span>
          <Badge tone="neutral">
            <FadeValue value={queue.online} /> en línia
          </Badge>
        </div>
      </header>

      <DrawerSection title="Salut de la cua">
        <StatGrid>
          <Stat label="Backlog" value={queue.backlog} tone={queue.backlog > 8 ? 'alert' : undefined} />
          <Stat label="Espera màxima" value={formatSeconds(queue.longest)} tone={queue.longest > 150 ? 'alert' : undefined} />
          <Stat label="Espera mitjana" value={formatSeconds(queue.avg)} />
          <Stat label="En línia" value={queue.online} />
        </StatGrid>
      </DrawerSection>

      <DrawerSection
        title={
          <>
            En espera (<FadeValue value={waiting.length} />)
          </>
        }
      >
        {waiting.length === 0 ? (
          <EmptyHint>Res en espera.</EmptyHint>
        ) : (
          <div className="dd-list">
            {waiting.map((item) => {
              const icon = resolveWorkItemIcon(item)
              return (
                <DetailRow
                  key={item.id}
                  leading={<SfIcon sprite={icon.sprite} symbol={icon.symbol} sldsSize="small" bg={colorFromRecordId(item.id)} />}
                  title={item.subject}
                  meta={
                    <>
                      {channelLabel(item.channelKey)} · <FadeValue value={formatSeconds(item.ageSec)} />
                    </>
                  }
                  onClick={() => openWork(item.id)}
                />
              )
            })}
          </div>
        )}
      </DrawerSection>

      <DrawerSection
        title={
          <>
            Agents assignats (<FadeValue value={members.length} />)
          </>
        }
      >
        {members.length === 0 ? (
          <EmptyHint>Cap agent assignat.</EmptyHint>
        ) : (
          <div className="dd-list">
            {members.map((agent) => (
              <MiniAgentRow key={agent.id} agent={agent} onClick={() => openAgent(agent.id)} />
            ))}
          </div>
        )}
      </DrawerSection>
    </>
  )
}
