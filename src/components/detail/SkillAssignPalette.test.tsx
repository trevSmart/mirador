import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Skill } from '../../api/types'
import { SkillAssignPalette } from './SkillAssignPalette'

function makeSkills(): Skill[] {
  return [
    { id: 'sk1', name: 'Facturació', type: 'Vendes', typeId: 't1', agents: 3, backlog: 0 },
    { id: 'sk2', name: 'Suport tècnic', type: 'Suport', typeId: 't2', agents: 5, backlog: 2 },
    { id: 'sk3', name: 'Facturació avançada', type: 'Vendes', typeId: 't1', agents: 1, backlog: 0 },
  ]
}

describe('SkillAssignPalette', () => {
  it('llista totes les skills passades', () => {
    render(<SkillAssignPalette skills={makeSkills()} onAssign={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Facturació')).toBeInTheDocument()
    expect(screen.getByText('Suport tècnic')).toBeInTheDocument()
    expect(screen.getByText('Facturació avançada')).toBeInTheDocument()
  })

  it('filtra per cerca (case-insensitive sobre el nom)', () => {
    render(<SkillAssignPalette skills={makeSkills()} onAssign={() => {}} onCancel={() => {}} />)
    const search = screen.getByPlaceholderText(/cerca/i)
    fireEvent.change(search, { target: { value: 'suport' } })
    expect(screen.getByText('Suport tècnic')).toBeInTheDocument()
    expect(screen.queryByText('Facturació')).not.toBeInTheDocument()
    expect(screen.queryByText('Facturació avançada')).not.toBeInTheDocument()
  })

  it('clic en una skill crida onAssign amb el skillId i level null si no hi ha nivell', () => {
    const onAssign = vi.fn()
    render(<SkillAssignPalette skills={makeSkills()} onAssign={onAssign} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Facturació'))
    expect(onAssign).toHaveBeenCalledWith('sk1', null)
  })

  it('clic en una skill crida onAssign amb el nivell introduït', () => {
    const onAssign = vi.fn()
    render(<SkillAssignPalette skills={makeSkills()} onAssign={onAssign} onCancel={() => {}} />)
    const levelInput = screen.getByLabelText(/nivell/i)
    fireEvent.change(levelInput, { target: { value: '3' } })
    fireEvent.click(screen.getByText('Suport tècnic'))
    expect(onAssign).toHaveBeenCalledWith('sk2', 3)
  })

  it('el botó de cancel·lar crida onCancel', () => {
    const onCancel = vi.fn()
    render(<SkillAssignPalette skills={makeSkills()} onAssign={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disabled bloqueja les interaccions', () => {
    const onAssign = vi.fn()
    render(<SkillAssignPalette skills={makeSkills()} disabled onAssign={onAssign} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Facturació'))
    expect(onAssign).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText(/cerca/i)).toBeDisabled()
    expect(screen.getByLabelText(/nivell/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('mostra un buit si no hi ha skills assignables', () => {
    render(<SkillAssignPalette skills={[]} onAssign={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/no hi ha més skills per assignar/i)).toBeInTheDocument()
  })
})
