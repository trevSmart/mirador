import { useMemo, useState } from 'react'
import { useAgents, useCapabilities } from '../../api/data-hooks'
import { useUpdateAgentSkills } from '../../api/skill-mutations'
import type { Agent, AgentSkillChange, Skill } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { sortAgentsByPresence } from '../../utils/agent-stats'
import { colorFromRecordId } from '../../utils/color-from-string'
import { AgentAvatar } from '../AgentRow'
import { Badge, Button, SfIcon, useToast } from '../ds'
import { DetailRow, DrawerActions, DrawerSection, EmptyHint, MiniAgentRow, Stat, StatGrid } from './parts'

function hasSkill(agent: Agent, skill: Skill): boolean {
  return agent.skills.some((s) => s.skillId === skill.id)
}

export function SkillDetail({ skill }: { skill: Skill }) {
  const agents = useAgents()
  const canEdit = useCapabilities()?.canChangeSkills === true
  const mutation = useUpdateAgentSkills()
  const toast = useToast()
  const { openAgent } = useDetailDrawer()
  const [assigning, setAssigning] = useState(false)

  const qualified = sortAgentsByPresence(agents.filter((agent) => hasSkill(agent, skill)))

  function runChange(agentId: string, changes: AgentSkillChange[], successMsg: string) {
    mutation.mutate(
      { agentId, changes },
      {
        onSuccess: () => toast.success(successMsg),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No s\'ha pogut desar el canvi'),
      },
    )
  }

  return (
    <>
      <header className="dd-head">
        <SfIcon name="skill" size={56} bg={colorFromRecordId(skill.id)} />
        <div className="dd-head__id">
          <h2 className="dd-head__name" style={{ color: colorFromRecordId(skill.id) }}>
            {skill.name}
          </h2>
          <span className="dd-head__sub">{skill.type ?? 'Skill'}</span>
          <Badge tone={skill.backlog > 4 ? 'alert' : 'neutral'}>{skill.backlog} backlog</Badge>
        </div>
      </header>

      <DrawerActions
        actions={[
          {
            label: 'Assigna agents',
            icon: 'add',
            primary: true,
            ...(canEdit ? { onClick: () => setAssigning((v) => !v) } : {}),
          },
          { label: 'Encaminament', icon: 'sliders' },
        ]}
      />

      {assigning && canEdit ? (
        <DrawerSection title="Assigna agents">
          <SkillAgentAssignList
            agents={agents}
            skill={skill}
            disabled={mutation.isPending}
            onToggle={(agent) =>
              hasSkill(agent, skill)
                ? runChange(agent.id, [{ skillId: skill.id, remove: true }], `S'ha tret «${skill.name}» a ${agent.name}`)
                : runChange(agent.id, [{ skillId: skill.id }], `S'ha assignat «${skill.name}» a ${agent.name}`)
            }
            onClose={() => setAssigning(false)}
          />
        </DrawerSection>
      ) : null}

      <DrawerSection title="Resum">
        <StatGrid>
          <Stat label="Agents qualificats" value={skill.agents} />
          <Stat label="Backlog" value={skill.backlog} tone={skill.backlog > 4 ? 'alert' : undefined} />
        </StatGrid>
      </DrawerSection>

      <DrawerSection title={`Agents qualificats (${qualified.length})`}>
        {qualified.length === 0 ? (
          <EmptyHint>Cap agent qualificat.</EmptyHint>
        ) : (
          <div className="dd-list">
            {qualified.map((agent) => (
              <MiniAgentRow key={agent.id} agent={agent} onClick={() => openAgent(agent.id)} />
            ))}
          </div>
        )}
      </DrawerSection>
    </>
  )
}

/** Llista de tots els agents amb cerca, per assignar o treure aquesta skill.
    Mirall de `SkillAssignPalette` (que fa el mateix però amb skills sobre un agent). */
function SkillAgentAssignList({
  agents,
  skill,
  disabled,
  onToggle,
  onClose,
}: {
  agents: Agent[]
  skill: Skill
  disabled: boolean
  onToggle: (agent: Agent) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sortAgentsByPresence(agents.filter((agent) => !needle || agent.name.toLowerCase().includes(needle))).slice(
      0,
      50,
    )
  }, [agents, query])

  return (
    <section className="dd-skill-palette">
      <input
        className="dd-skill-palette__search"
        type="search"
        placeholder="Cerca un agent…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="dd-list">
        {filtered.length === 0 ? (
          <EmptyHint>No hi ha agents que coincideixin amb la cerca.</EmptyHint>
        ) : (
          filtered.map((agent) => {
            const assigned = hasSkill(agent, skill)
            return (
              <DetailRow
                key={agent.id}
                leading={<AgentAvatar id={agent.id} name={agent.name} photo={agent.photo} />}
                title={agent.name}
                meta={agent.role}
                trailing={
                  <Button
                    variant={assigned ? 'ghost' : 'subtle'}
                    size="sm"
                    disabled={disabled}
                    onClick={() => onToggle(agent)}
                  >
                    {assigned ? 'Treu' : 'Assigna'}
                  </Button>
                }
              />
            )
          })
        )}
      </div>

      <div className="dd-skill-palette__actions">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onClose}>
          Tanca
        </Button>
      </div>
    </section>
  )
}
