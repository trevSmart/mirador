import { useDataStatus, useSkills } from '../api/data-hooks'
import { CollapsibleGroup } from '../components/CollapsibleGroup'
import { FadeValue, SfIcon } from '../components/ds'
import { PanelState } from '../components/PanelState'
import { SkillRow } from '../components/SkillRow'
import { groupSkillsByType, totalSkillBacklog } from '../utils/agent-stats'

export function SkillsPanel() {
  const skills = useSkills()
  const { isLoading, error, refresh } = useDataStatus()
  const groups = groupSkillsByType(skills)

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

      {groups.map((group) => (
        <CollapsibleGroup
          key={group.typeId ?? group.type}
          className="skill-group"
          icon={
            <SfIcon
              className="panel-section__icon"
              sprite="standard"
              symbol="skill_entity"
              sldsSize="x-small"
              recordId={group.typeId}
            />
          }
          title={<h3 className="panel-section__title">{group.type}</h3>}
          meta={
            <span className="skill-group__count">
              <FadeValue value={group.skills.length} /> skills · <FadeValue value={group.backlog} /> en cua
            </span>
          }
        >
          <div className="entity-list entity-list--grid">
            {group.skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        </CollapsibleGroup>
      ))}
    </PanelState>
  )
}
