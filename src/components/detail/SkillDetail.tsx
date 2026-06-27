import { useAgents } from '../../api/data-hooks'
import type { Skill } from '../../api/types'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { sortAgentsByPresence } from '../../utils/agent-stats'
import { colorFromString } from '../../utils/color-from-string'
import { SfIcon, Badge } from '../ds'
import { DrawerSection, EmptyHint, MiniAgentRow, Stat, StatGrid } from './parts'

export function SkillDetail({ skill }: { skill: Skill }) {
  const agents = useAgents()
  const { openAgent } = useDetailDrawer()

  const qualified = sortAgentsByPresence(
    agents.filter((agent) => agent.skills.some((s) => s.skillId === skill.id || s.name === skill.name)),
  )

  return (
    <>
      <header className="dd-head">
        <SfIcon name="skill" size={56} bg={colorFromString(skill.name)} />
        <div className="dd-head__id">
          <h2 className="dd-head__name">{skill.name}</h2>
          <span className="dd-head__sub">{skill.type ?? 'Skill'}</span>
          <Badge tone={skill.backlog > 4 ? 'alert' : 'neutral'}>{skill.backlog} backlog</Badge>
        </div>
      </header>

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
