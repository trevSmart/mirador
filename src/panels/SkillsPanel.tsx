import { useDataStatus, useSkills } from '../api/data-hooks'
import { FadeValue } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { SkillRow } from '../components/SkillRow'
import { sortSkillsByBacklog, totalSkillBacklog } from '../utils/agent-stats'

export function SkillsPanel() {
  const skills = useSkills()
  const { isLoading, error, refresh } = useDataStatus()
  const sortedSkills = sortSkillsByBacklog(skills)

  return (
    <PanelState
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={skills.length === 0}
      emptyMessage="No hi ha skills configurades."
    >
      <p className="panel-summary">
        <FadeValue value={skills.length} /> skills · <FadeValue value={totalSkillBacklog(skills)} /> treballs en cua
      </p>

      <div className="entity-list entity-list--grid">
        {sortedSkills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>
    </PanelState>
  )
}
