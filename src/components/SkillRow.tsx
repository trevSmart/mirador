import type { Skill } from '../api/types'

interface SkillRowProps {
  skill: Skill
}

export function SkillRow({ skill }: SkillRowProps) {
  return (
    <article className="skill-row">
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
