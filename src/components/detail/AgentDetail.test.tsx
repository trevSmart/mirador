import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, Capabilities, Skill } from '../../api/types'

const useQueuesMock = vi.fn(() => [])
const useCapabilitiesMock = vi.fn<() => Capabilities | null>(() => null)
const useSkillsMock = vi.fn<() => Skill[]>(() => [])
vi.mock('../../api/data-hooks', () => ({
  useQueues: () => useQueuesMock(),
  useCapabilities: () => useCapabilitiesMock(),
  useSkills: () => useSkillsMock(),
}))

const mutateMock = vi.fn()
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

vi.mock('../../detail/detail-drawer-context', () => ({
  useDetailDrawer: () => ({ openQueue: vi.fn(), openWork: vi.fn() }),
}))

vi.mock('../../hooks/useSalesforcePhoto', () => ({
  useSalesforcePhoto: () => null,
}))

import { AgentDetail } from './AgentDetail'

// JSDOM no implementa matchMedia; CapacityBar el consulta per reduced-motion.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
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
    skills: [
      { id: 'as1', skillId: 'sk1', name: 'Facturació', type: 'Vendes', level: 2, startDate: null, lastModifiedDate: null, lastModifiedBy: null },
    ],
    ...overrides,
  } as Agent
}

function makeSkillCatalog(): Skill[] {
  return [
    { id: 'sk1', name: 'Facturació', type: 'Vendes', typeId: 't1', agents: 3, backlog: 0 },
    { id: 'sk2', name: 'Suport tècnic', type: 'Suport', typeId: 't2', agents: 5, backlog: 2 },
  ]
}

describe('AgentDetail — secció Skills', () => {
  beforeEach(() => {
    useQueuesMock.mockReturnValue([])
    useCapabilitiesMock.mockReturnValue(null)
    useSkillsMock.mockReturnValue(makeSkillCatalog())
    useUpdateAgentSkillsMock.mockReturnValue({ mutate: mutateMock, isPending: false })
    mutateMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('read-only quan canChangeSkills és false: sense botó afegir ni treure', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: false } as Capabilities)
    render(<AgentDetail agent={makeAgent()} />)
    expect(screen.getByText('Facturació')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /afegeix skill/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/treu/i)).not.toBeInTheDocument()
  })

  it('read-only quan capabilities és null', () => {
    useCapabilitiesMock.mockReturnValue(null)
    render(<AgentDetail agent={makeAgent()} />)
    expect(screen.queryByRole('button', { name: /afegeix skill/i })).not.toBeInTheDocument()
  })

  it('amb canChangeSkills true, treure una skill crida mutate amb remove:true', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    render(<AgentDetail agent={makeAgent()} />)
    const removeBtn = screen.getByTitle(/treu/i)
    fireEvent.click(removeBtn)
    expect(mutateMock).toHaveBeenCalledWith(
      { agentId: 'a1', changes: [{ skillId: 'sk1', remove: true }] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('en èxit del canvi es crida toast.success', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    render(<AgentDetail agent={makeAgent()} />)
    fireEvent.click(screen.getByTitle(/treu/i))
    const call = mutateMock.mock.calls[0][1]
    call.onSuccess()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('en error del canvi es crida toast.error', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    render(<AgentDetail agent={makeAgent()} />)
    fireEvent.click(screen.getByTitle(/treu/i))
    const call = mutateMock.mock.calls[0][1]
    call.onError(new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('boom')
  })

  it('amb skillId null, la fila és read-only encara que canChangeSkills sigui true', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    render(
      <AgentDetail
        agent={makeAgent({
          skills: [
            { id: 'as1', skillId: null, name: 'Facturació', type: 'Vendes', level: 2, startDate: null, lastModifiedDate: null, lastModifiedBy: null },
          ],
        })}
      />,
    )
    expect(screen.getByText('Facturació')).toBeInTheDocument()
    expect(screen.queryByTitle(/treu/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nivell')).not.toBeInTheDocument()
  })

  it('assignar des de la palette crida mutate amb la nova skill', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    render(<AgentDetail agent={makeAgent()} />)
    fireEvent.click(screen.getByRole('button', { name: /afegeix skill/i }))
    fireEvent.click(screen.getByText('Suport tècnic'))
    expect(mutateMock).toHaveBeenCalledWith(
      { agentId: 'a1', changes: [{ skillId: 'sk2' }] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })
})
