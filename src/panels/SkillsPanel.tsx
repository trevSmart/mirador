import type { IDockviewPanelProps } from 'dockview'
import { useMiradorData } from '../api/MiradorDataProvider'
import { PanelState } from '../components/PanelState'
import { SkillRow } from '../components/SkillRow'
import { sortSkillsByBacklog, totalSkillBacklog } from '../utils/agent-stats'

export function SkillsPanel({ api }: IDockviewPanelProps) {
  const { skills, isLoading, error, refresh } = useMiradorData()
  const sortedSkills = sortSkillsByBacklog(skills)

  return (
    <PanelState
      title={api.title}
      isLoading={isLoading}
      error={error}
      onRetry={refresh}
      isEmpty={skills.length === 0}
      emptyMessage="No hi ha skills configurades."
      actions={
        <button
          type="button"
          className="panel-shell__action"
          onClick={() => void refresh()}
          disabled={isLoading}
        >
          Actualitza
        </button>
      }
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
