import type { Skill } from '../api/types'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { colorFromString } from '../utils/color-from-string'
import { FadeValue, MetricPill, PressureBar, SfIcon } from './ds'

/** Backlog count that reads as "full" pressure on the bar. */
const BACKLOG_FULL = 20

interface SkillRowProps {
  skill: Skill
}

export function SkillRow({ skill }: SkillRowProps) {
  const pressure = Math.min(1, skill.backlog / BACKLOG_FULL)
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
        <SfIcon name="skill" sldsSize="medium" bg={colorFromString(skill.name)} />
        <div className="skill-row__body">
          <h3 className="skill-row__name" title={skill.name}>{skill.name}</h3>
          <p className="skill-row__meta">
            {skill.type ?? 'Sense tipus'} · <FadeValue value={skill.agents} /> agents qualificats
          </p>
        </div>
      </div>

      <PressureBar value={pressure} />

      <div className="skill-row__metrics">
        <MetricPill label="Backlog" value={skill.backlog} />
        <MetricPill label="Agents" value={skill.agents} />
      </div>
    </article>
  )
}
