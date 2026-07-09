import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, Capabilities, Skill } from '../../api/types'
import type { UpdateAgentSkillsVars } from '../../api/skill-mutations'

type SkillMutateOptions = {
  onSuccess: () => void
  onError: (error: Error) => void
}

const useAgentsMock = vi.fn<() => Agent[]>(() => [])
const useCapabilitiesMock = vi.fn<() => Capabilities | null>(() => null)
vi.mock('../../api/data-hooks', () => ({
  useAgents: () => useAgentsMock(),
  useCapabilities: () => useCapabilitiesMock(),
}))

const mutateMock =
  vi.fn<(vars: UpdateAgentSkillsVars, opts: SkillMutateOptions) => void>()
const useUpdateAgentSkillsMock = vi.fn(() => ({ mutate: mutateMock, isPending: false }))
vi.mock('../../api/skill-mutations', () => ({
  useUpdateAgentSkills: () => useUpdateAgentSkillsMock(),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('../ds', async () => {
  const actual = await vi.importActual<typeof import('../ds')>('../ds')
  return {
    ...actual,
    useToast: () => ({ success: toastSuccess, error: toastError }),
  }
})

const openAgentMock = vi.fn()
vi.mock('../../detail/detail-drawer-context', () => ({
  useDetailDrawer: () => ({ openAgent: openAgentMock }),
}))

vi.mock('../../hooks/useSalesforcePhoto', () => ({
  useSalesforcePhoto: () => null,
}))

import { SkillDetail } from './SkillDetail'

// JSDOM no implementa matchMedia; alguns subcomponents del drawer el consulten.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'sk1',
    name: 'Facturació',
    type: 'Vendes',
    typeId: 't1',
    agents: 1,
    backlog: 2,
    ...overrides,
  }
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    name: 'Marta',
    role: 'Agent',
    recordUrl: null,
    status: 'online',
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: 3,
    used: 1,
    queueIds: [],
    loginMin: 0,
    photo: null,
    chans: {},
    work: [],
    skills: [],
    ...overrides,
  } as Agent
}

describe('SkillDetail — assignar agents', () => {
  beforeEach(() => {
    useAgentsMock.mockReturnValue([])
    useCapabilitiesMock.mockReturnValue(null)
    useUpdateAgentSkillsMock.mockReturnValue({ mutate: mutateMock, isPending: false })
    mutateMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    openAgentMock.mockReset()
  })

  it('read-only quan canChangeSkills és false: clicar "Assigna agents" no obre la llista', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: false } as Capabilities)
    useAgentsMock.mockReturnValue([makeAgent({ id: 'a2', name: 'Pere' })])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    expect(screen.queryByPlaceholderText(/cerca un agent/i)).not.toBeInTheDocument()
  })

  it('read-only quan capabilities és null', () => {
    useCapabilitiesMock.mockReturnValue(null)
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    expect(screen.queryByPlaceholderText(/cerca un agent/i)).not.toBeInTheDocument()
  })

  it('amb canChangeSkills true, clicar "Assigna agents" mostra la llista d\'agents', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([
      makeAgent({ id: 'a2', name: 'Pere', skills: [] }),
      makeAgent({
        id: 'a3',
        name: 'Núria',
        skills: [{ id: 'as1', skillId: 'sk1', name: 'Facturació', type: 'Vendes', level: 1, startDate: null, lastModifiedDate: null, lastModifiedBy: null }],
      }),
    ])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    expect(screen.getByPlaceholderText(/cerca un agent/i)).toBeInTheDocument()
    expect(screen.getByText('Pere')).toBeInTheDocument()
    // Núria ja és qualificada, per tant surt tant a "Agents qualificats" com a la llista d'assignació.
    expect(screen.getAllByText('Núria').length).toBeGreaterThanOrEqual(1)
  })

  it('no confon skills amb el mateix nom però id diferent', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([
      makeAgent({
        id: 'a2',
        name: 'Pere',
        // Té una skill amb el mateix nom «Facturació» però un id diferent (sk-altre).
        skills: [{ id: 'as9', skillId: 'sk-altre', name: 'Facturació', type: 'Vendes', level: 1, startDate: null, lastModifiedDate: null, lastModifiedBy: null }],
      }),
    ])
    render(<SkillDetail skill={makeSkill({ id: 'sk1' })} />)
    // No hauria de sortir com a "qualificat" per aquesta skill (sk1), ja que la seva és sk-altre.
    expect(screen.queryByText('Pere')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    // A la llista d'assignació hauria d'aparèixer com a "Assigna", no com a "Treu".
    expect(screen.getByRole('button', { name: /^assigna$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^treu$/i })).not.toBeInTheDocument()
  })

  it('assignar un agent sense la skill crida mutate amb la skill actual', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([makeAgent({ id: 'a2', name: 'Pere', skills: [] })])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    fireEvent.click(screen.getByRole('button', { name: /^assigna$/i }))
    const [vars, opts] = mutateMock.mock.calls[0]
    expect(vars).toEqual({ agentId: 'a2', changes: [{ skillId: 'sk1' }] })
    expect(typeof opts.onSuccess).toBe('function')
    expect(typeof opts.onError).toBe('function')
  })

  it('treure la skill d\'un agent qualificat crida mutate amb remove:true', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([
      makeAgent({
        id: 'a3',
        name: 'Núria',
        skills: [{ id: 'as1', skillId: 'sk1', name: 'Facturació', type: 'Vendes', level: 1, startDate: null, lastModifiedDate: null, lastModifiedBy: null }],
      }),
    ])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    fireEvent.click(screen.getByRole('button', { name: /^treu$/i }))
    const [vars, opts] = mutateMock.mock.calls[0]
    expect(vars).toEqual({ agentId: 'a3', changes: [{ skillId: 'sk1', remove: true }] })
    expect(typeof opts.onSuccess).toBe('function')
    expect(typeof opts.onError).toBe('function')
  })

  it('en èxit del canvi es crida toast.success', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([makeAgent({ id: 'a2', name: 'Pere', skills: [] })])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    fireEvent.click(screen.getByRole('button', { name: /^assigna$/i }))
    const call = mutateMock.mock.calls[0][1]
    call.onSuccess()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('en error del canvi es crida toast.error', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    useAgentsMock.mockReturnValue([makeAgent({ id: 'a2', name: 'Pere', skills: [] })])
    render(<SkillDetail skill={makeSkill()} />)
    fireEvent.click(screen.getByRole('button', { name: /assigna agents/i }))
    fireEvent.click(screen.getByRole('button', { name: /^assigna$/i }))
    const call = mutateMock.mock.calls[0][1]
    call.onError(new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('boom')
  })
})
