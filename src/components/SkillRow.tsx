import type { Skill } from '../api/types'
import { useDetailDrawer } from '../detail/DetailDrawerContext'

interface SkillRowProps {
  skill: Skill
}

export function SkillRow({ skill }: SkillRowProps) {
  const { openSkill } = useDetailDrawer()

  return (
    <article
      className="skill-row skill-row--clickable"
      role="button"
      tabIndex={0}
      onClick={() => openSkill(skill.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openSkill(skill.id)
        }
      }}
    >
      <div className="skill-row__main">
        <div>
          <h3 className="skill-row__name">{skill.name}</h3>
          <p className="skill-row__meta">
            {skill.type ?? 'Sense tipus'} · {skill.agents} agents qualificats
          </p>
        </div>
      </div>

      <div className="skill-row__metrics">
        <div className="metric-pill">
          <span className="metric-pill__label">Backlog</span>
          <span className="metric-pill__value">{skill.backlog}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill__label">Agents</span>
          <span className="metric-pill__value">{skill.agents}</span>
        </div>
      </div>
    </article>
  )
}
