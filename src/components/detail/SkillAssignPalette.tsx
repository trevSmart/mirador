import { useMemo, useState } from 'react'
import type { Skill } from '../../api/types'
import { Button, SfIcon } from '../ds'
import { EmptyHint } from './parts'

interface SkillAssignPaletteProps {
  /** Catàleg JA filtrat a skills assignables (no assignades encara a l'agent). */
  skills: Skill[]
  /** Cert mentre es desa un canvi: bloqueja tots els controls. */
  disabled?: boolean
  onAssign: (skillId: string, level: number | null) => void
  onCancel: () => void
}

export function SkillAssignPalette({ skills, disabled = false, onAssign, onCancel }: SkillAssignPaletteProps) {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return skills.filter((skill) => !needle || skill.name.toLowerCase().includes(needle)).slice(0, 50)
  }, [skills, query])

  const parsedLevel = (() => {
    const trimmed = level.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  })()

  return (
    <section className="dd-skill-palette">
      <input
        className="dd-skill-palette__search"
        type="search"
        placeholder="Cerca una skill…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
      />

      <label className="dd-skill-palette__level">
        Nivell (opcional)
        <input
          type="number"
          value={level}
          disabled={disabled}
          onChange={(e) => setLevel(e.target.value)}
        />
      </label>

      <div className="dd-skill-palette__list">
        {filtered.length === 0 ? (
          <EmptyHint>No hi ha més skills per assignar.</EmptyHint>
        ) : (
          filtered.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className="dd-skill-palette__item"
              disabled={disabled}
              onClick={() => onAssign(skill.id, parsedLevel)}
            >
              <SfIcon name="skill" size={28} recordId={skill.id} />
              <span className="dd-skill-palette__item-body">
                <span className="dd-skill-palette__item-name">{skill.name}</span>
                <span className="dd-skill-palette__item-meta">{skill.type}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="dd-skill-palette__actions">
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onCancel}>
          Cancel·la
        </Button>
      </div>
    </section>
  )
}
