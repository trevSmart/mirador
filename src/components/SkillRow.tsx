import type { Skill } from '../api/types'
import { useDetailActivation } from '../detail/useDetailActivation'
import { colorFromRecordId } from '../utils/color-from-string'
import { FadeValue, MetricPill, SfIcon } from './ds'

interface SkillRowProps {
  skill: Skill
}

export function SkillRow({ skill }: SkillRowProps) {
  const activation = useDetailActivation({ kind: 'skill', id: skill.id })

  return (
    <article className="skill-row skill-row--clickable" {...activation}>
      <div className="skill-row__main">
        <SfIcon name="skill" sldsSize="medium" bg={colorFromRecordId(skill.id)} />
        <div className="skill-row__body">
          <h3 className="skill-row__name" title={skill.name} style={{ color: colorFromRecordId(skill.id) }}>
            {skill.name}
          </h3>
          <p className="skill-row__meta">
            {skill.type ?? 'Sense tipus'} · <FadeValue value={skill.agents} /> agents qualificats
          </p>
        </div>
      </div>

      <div className="skill-row__metrics">
        <MetricPill label="Backlog" value={skill.backlog} />
        <MetricPill label="Agents" value={skill.agents} />
      </div>
    </article>
  )
}
