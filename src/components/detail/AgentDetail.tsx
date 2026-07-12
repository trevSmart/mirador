import { useState } from 'react'
import { useCapabilities, useSkills } from '../../api/data-hooks'
import { queueResource, useEntities } from '../../api/data-service'
import { useUpdateAgentSkills } from '../../api/skill-mutations'
import type { Agent, AgentSkillChange, ChannelKey } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { colorFromRecordId, textColorFromRecordId } from '../../utils/color-from-string'
import { capacityColor } from '../../utils/agent-stats'
import { agentInitials, channelLabel, formatMinutes } from '../../utils/format'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AppIcon, Button, CapacityBar, FadeValue, Ring, SfIcon, useToast } from '../ds'
import { StatusBadge } from '../StatusBadge'
import { AgentTimeline } from './AgentTimeline'
import { DetailRow, DrawerActions, DrawerSection, EmptyHint, Stat, StatGrid } from './parts'
import { SkillAssignPalette } from './SkillAssignPalette'

type AgentTab = 'detail' | 'timeline'

const CHANNELS: ChannelKey[] = ['veu', 'chat', 'email', 'wa', 'cas']

export function AgentDetail({ agent }: { agent: Agent }) {
  const catalog = useSkills()
  const caps = useCapabilities()
  const mutation = useUpdateAgentSkills()
  const toast = useToast()
  const { openQueue, openWork } = useDetailDrawer()
  const photo = useSalesforcePhoto(agent.photo)
  const color = capacityColor(agent)
  const queueIds = [...new Set(agent.queueIds)]
  // Només les cues d'aquest agent, cadascuna una entrada de caché pròpia ja
  // primada pel snapshot: no cal subscriure's a la col·lecció sencera de cues.
  const queues = useEntities(queueResource, queueIds).map((query) => query.data)
  const canEdit = caps?.canChangeSkills === true
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState<AgentTab>('detail')

  function runChange(changes: AgentSkillChange[], successMsg: string) {
    mutation.mutate(
      { agentId: agent.id, changes },
      {
        onSuccess: () => toast.success(successMsg),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No s\'ha pogut desar el canvi'),
      },
    )
  }

  const assignedSkillIds = new Set(agent.skills.map((s) => s.skillId))
  const assignable = catalog.filter((s) => !assignedSkillIds.has(s.id))

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

      <DrawerActions
        actions={[
          { label: 'Assigna treball', icon: 'add', primary: true },
          { label: 'Missatge', icon: 'notification' },
          { label: 'Registre', icon: 'clock' },
        ]}
      />

      {agent.recordUrl ? (
        <div className="dd-actions">
          <a className="dd-action" href={agent.recordUrl} target="_blank" rel="noreferrer">
            <AppIcon name="new_window" size={15} />
            Obre a Salesforce
          </a>
        </div>
      ) : null}

      <div className="dd-tabs" role="group" aria-label="Vista de l'agent">
        <button
          type="button"
          className="dd-tab"
          aria-pressed={tab === 'detail'}
          onClick={() => setTab('detail')}
        >
          Detall
        </button>
        <button
          type="button"
          className="dd-tab"
          aria-pressed={tab === 'timeline'}
          onClick={() => setTab('timeline')}
        >
          Cronologia
        </button>
      </div>

      {tab === 'timeline' ? (
        <DrawerSection title="Cronologia d'avui">
          <AgentTimeline agent={agent} />
        </DrawerSection>
      ) : (
        <>
      <DrawerSection title="Resum">
        <CapacityBar used={agent.used} max={agent.max} color={capacityColor(agent)} />
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
            {agent.skills.map((skill) => {
              const skillId = skill.skillId
              return (
                <DetailRow
                  key={skill.id}
                  leading={<SfIcon name="skill" size={28} recordId={skill.id} />}
                  title={skill.name}
                  meta={[skill.type, skill.level != null ? `Nivell ${skill.level}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    canEdit && skillId != null ? (
                      <span className="dd-skill-row__actions">
                        <SkillLevelInput
                          initialLevel={skill.level}
                          disabled={mutation.isPending}
                          onCommit={(level) =>
                            runChange([{ skillId, level }], `S'ha actualitzat el nivell de «${skill.name}»`)
                          }
                        />
                        <button
                          type="button"
                          className="dd-skill-row__remove"
                          title="Treu la skill"
                          disabled={mutation.isPending}
                          onClick={() => runChange([{ skillId, remove: true }], `S'ha tret «${skill.name}»`)}
                        >
                          <AppIcon name="close" size={14} />
                        </button>
                      </span>
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        )}
        {canEdit ? (
          adding ? (
            <SkillAssignPalette
              skills={assignable}
              disabled={mutation.isPending}
              onAssign={(skillId, level) => {
                const skillName = catalog.find((s) => s.id === skillId)?.name ?? skillId
                runChange(
                  [{ skillId, ...(level != null ? { level } : {}) }],
                  `S'ha assignat «${skillName}»`,
                )
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button size="sm" icon={<AppIcon name="add" size={15} />} onClick={() => setAdding(true)}>
              Afegeix skill
            </Button>
          )
        ) : null}
      </DrawerSection>

      <DrawerSection title="Cues assignades">
        {queueIds.length === 0 ? (
          <EmptyHint>Cap cua assignada.</EmptyHint>
        ) : (
          <div className="dd-list">
            {queues.map((queue) => {
              if (!queue) return null
              return (
                <DetailRow
                  key={queue.id}
                  leading={<SfIcon name="queue" size={28} recordId={queue.id} />}
                  title={queue.name}
                  meta={
                    <>
                      <FadeValue value={queue.backlog} /> backlog · <FadeValue value={queue.online} /> en línia
                    </>
                  }
                  onClick={() => openQueue(queue.id)}
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
                  leading={<SfIcon sprite={icon.sprite} symbol={icon.symbol} size={28} recordId={item.id} />}
                  title={item.subject || item.label}
                  meta={meta}
                  onClick={() => openWork(item.id)}
                />
              )
            })}
          </div>
        )}
      </DrawerSection>
        </>
      )}
    </>
  )
}

/** Input de nivell d'una skill assignada: comita només quan el valor canvia
    (blur o Enter), no a cada tecla, per no disparar una mutació per lletra. */
function SkillLevelInput({
  initialLevel,
  disabled,
  onCommit,
}: {
  initialLevel: number | null
  disabled: boolean
  onCommit: (level: number) => void
}) {
  const [value, setValue] = useState(initialLevel != null ? String(initialLevel) : '')

  function commit() {
    const trimmed = value.trim()
    if (trimmed === '') return
    const level = Number(trimmed)
    if (Number.isNaN(level) || level === initialLevel) return
    onCommit(level)
  }

  return (
    <input
      type="number"
      className="dd-skill-row__level"
      aria-label="Nivell"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}
