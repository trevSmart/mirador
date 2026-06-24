import type { IDockviewPanelProps } from 'dockview-react'
import { useMiradorData } from '../api/mirador-data-context'
import { useMiradorStatus } from '../api/mirador-status-context'
import { PanelState } from '../components/PanelState'
import { SkillRow } from '../components/SkillRow'
import { sortSkillsByBacklog, totalSkillBacklog } from '../utils/agent-stats'

export function SkillsPanel({ api }: IDockviewPanelProps) {
  const { skills } = useMiradorData()
  const { isLoading, error, refresh } = useMiradorStatus()
  const sortedSkills = sortSkillsByBacklog(skills)

  return (
    <PanelState
      panelType="skills"
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={skills.length === 0}
      emptyMessage="No hi ha skills configurades."
    >
      <p className="panel-summary">
        {skills.length} skills · {totalSkillBacklog(skills)} treballs en cua
      </p>

      <div className="entity-list">
        {sortedSkills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>
    </PanelState>
  )
}
