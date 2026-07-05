import { useQueues } from '../../api/data-hooks'
import type { Agent, ChannelKey, PresenceStatus } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { colorFromRecordId, textColorFromRecordId } from '../../utils/color-from-string'
import { agentInitials, channelLabel, formatMinutes } from '../../utils/format'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AppIcon, CapacityBar, FadeValue, Ring, SfIcon } from '../ds'
import { StatusBadge } from '../StatusBadge'
import { DetailRow, DrawerSection, EmptyHint, Stat, StatGrid } from './parts'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const CHANNELS: ChannelKey[] = ['veu', 'chat', 'email', 'wa', 'cas']

export function AgentDetail({ agent }: { agent: Agent }) {
  const queues = useQueues()
  const { openQueue } = useDetailDrawer()
  const photo = useSalesforcePhoto(agent.photo)
  const color = STATUS_COLOR[agent.status]
  const queueIds = [...new Set(agent.queueIds)]

  return (
    <>
      <header className="dd-head">
        <Ring
          used={agent.used}
          max={agent.max}
          color={color}
          size={56}
          photo={photo}
          initials={agentInitials(agent.name)}
          faceBg={colorFromRecordId(agent.id)}
          faceFg={textColorFromRecordId(agent.id)}
          breathe={agent.status === 'busy'}
        />
        <div className="dd-head__id">
          <h2 className="dd-head__name">{agent.name}</h2>
          <span className="dd-head__sub">{agent.role}</span>
          <StatusBadge status={agent.status} />
        </div>
      </header>

      {agent.recordUrl ? (
        <div className="dd-actions">
          <a className="dd-action" href={agent.recordUrl} target="_blank" rel="noreferrer">
            <AppIcon name="new_window" size={15} />
            Obre a Salesforce
          </a>
        </div>
      ) : null}

      <DrawerSection title="Resum">
        <CapacityBar used={agent.used} max={agent.max} color={color} />
        <StatGrid>
          <Stat label="Temps en estat" value={agent.loginMin > 0 ? formatMinutes(agent.loginMin) : '—'} />
          <Stat label="Feina activa" value={agent.work.length} />
          <Stat label="Cues" value={queueIds.length} />
        </StatGrid>
      </DrawerSection>

      <DrawerSection title="Canals">
        <div className="dd-channels">
          {CHANNELS.map((ch) => (
            <div key={ch} className="dd-channel" data-active={(agent.chans[ch] ?? 0) > 0 ? 'true' : 'false'}>
              <SfIcon channel={ch} sldsSize="x-small" />
              <FadeValue value={agent.chans[ch] ?? 0} />
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection title="Skills">
        {agent.skills.length === 0 ? (
          <EmptyHint>Sense skills assignades.</EmptyHint>
        ) : (
          <div className="dd-list">
            {agent.skills.map((skill) => (
              <DetailRow
                key={skill.id}
                leading={<SfIcon name="skill" size={28} />}
                title={skill.name}
                meta={[skill.type, skill.level != null ? `Nivell ${skill.level}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Cues assignades">
        {queueIds.length === 0 ? (
          <EmptyHint>Cap cua assignada.</EmptyHint>
        ) : (
          <div className="dd-list">
            {queueIds.map((queueId) => {
              const queue = queues.find((q) => q.id === queueId)
              if (!queue) return null
              return (
                <DetailRow
                  key={queueId}
                  leading={<SfIcon name="queue" size={28} bg={colorFromRecordId(queue.id)} />}
                  title={queue.name}
                  meta={
                    <>
                      <FadeValue value={queue.backlog} /> backlog · <FadeValue value={queue.online} /> en línia
                    </>
                  }
                  onClick={() => openQueue(queueId)}
                />
              )
            })}
          </div>
        )}
      </DrawerSection>

      <DrawerSection title="Feina activa">
        {agent.work.length === 0 ? (
          <EmptyHint>Sense feina activa.</EmptyHint>
        ) : (
          <div className="dd-list">
            {agent.work.map((item) => {
              const icon = resolveWorkItemIcon({ channelKey: item.channelKey })
              const meta = [channelLabel(item.channelKey), item.queue, item.ageMin > 0 ? formatMinutes(item.ageMin) : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <DetailRow
                  key={item.id}
                  leading={<SfIcon sprite={icon.sprite} symbol={icon.symbol} size={28} bg={colorFromRecordId(item.id)} />}
                  title={item.subject || item.label}
                  meta={meta}
                />
              )
            })}
          </div>
        )}
      </DrawerSection>
    </>
  )
}
