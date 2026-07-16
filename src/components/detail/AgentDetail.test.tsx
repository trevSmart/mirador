import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { entityKey, makeQueryClient } from '../../api/data-service'
import { MiradorApiContext } from '../../api/mirador-api-context'
import type { MiradorClient } from '../../api/mirador-client'
import type { Agent, Capabilities, Skill } from '../../api/types'
import type { UpdateAgentSkillsVars } from '../../api/skill-mutations'

type SkillMutateOptions = {
  onSuccess: () => void
  onError: (error: Error) => void
}

const useCapabilitiesMock = vi.fn<() => Capabilities | null>(() => null)
const useSkillsMock = vi.fn<() => Skill[]>(() => [])
vi.mock('../../api/data-hooks', () => ({
  useCapabilities: () => useCapabilitiesMock(),
  useSkills: () => useSkillsMock(),
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

vi.mock('../../detail/detail-drawer-context', () => ({
  useDetailDrawer: () => ({ openQueue: vi.fn(), openWork: vi.fn() }),
}))

vi.mock('../../hooks/useSalesforcePhoto', () => ({
  useSalesforcePhoto: () => null,
}))

// Stub the timeline so this suite stays focused on the detail/tab behaviour.
vi.mock('./AgentTimeline', () => ({
  AgentTimeline: () => <div data-testid="agent-timeline-stub" />,
}))

import { AgentDetail } from './AgentDetail'

// Les cues assignades es llegeixen per id de la caché del Data Service
// (useEntities), així que cal el QueryClient i un client de font.
let queryClient: QueryClient
const client = {} as MiradorClient

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MiradorApiContext.Provider value={client}>
        {children}
      </MiradorApiContext.Provider>
    </QueryClientProvider>
  )
}

function renderAgent(agent: Agent) {
  return render(<AgentDetail agent={agent} />, { wrapper: Wrapper })
}

// JSDOM no implementa matchMedia; CapacityBar el consulta per reduced-motion.
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
    queryClient = makeQueryClient()
    useCapabilitiesMock.mockReturnValue(null)
    useSkillsMock.mockReturnValue(makeSkillCatalog())
    useUpdateAgentSkillsMock.mockReturnValue({ mutate: mutateMock, isPending: false })
    mutateMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('read-only quan canChangeSkills és false: sense botó afegir ni treure', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: false } as Capabilities)
    renderAgent(makeAgent())
    expect(screen.getByText('Facturació')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /afegeix skill/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/treu/i)).not.toBeInTheDocument()
  })

  it('read-only quan capabilities és null', () => {
    useCapabilitiesMock.mockReturnValue(null)
    renderAgent(makeAgent())
    expect(screen.queryByRole('button', { name: /afegeix skill/i })).not.toBeInTheDocument()
  })

  it('amb canChangeSkills true, treure una skill crida mutate amb remove:true', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    renderAgent(makeAgent())
    const removeBtn = screen.getByTitle(/treu/i)
    fireEvent.click(removeBtn)
    const [vars, opts] = mutateMock.mock.calls[0]
    expect(vars).toEqual({ agentId: 'a1', changes: [{ skillId: 'sk1', remove: true }] })
    expect(typeof opts.onSuccess).toBe('function')
    expect(typeof opts.onError).toBe('function')
  })

  it('en èxit del canvi es crida toast.success', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    renderAgent(makeAgent())
    fireEvent.click(screen.getByTitle(/treu/i))
    const call = mutateMock.mock.calls[0][1]
    call.onSuccess()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('en error del canvi es crida toast.error', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    renderAgent(makeAgent())
    fireEvent.click(screen.getByTitle(/treu/i))
    const call = mutateMock.mock.calls[0][1]
    call.onError(new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('boom')
  })

  it('amb skillId null, la fila és read-only encara que canChangeSkills sigui true', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    renderAgent(
      makeAgent({
        skills: [
          { id: 'as1', skillId: null, name: 'Facturació', type: 'Vendes', level: 2, startDate: null, lastModifiedDate: null, lastModifiedBy: null },
        ],
      }),
    )
    expect(screen.getByText('Facturació')).toBeInTheDocument()
    expect(screen.queryByTitle(/treu/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nivell')).not.toBeInTheDocument()
  })

  it('la pestanya Cronologia mostra la timeline i amaga les seccions de detall', () => {
    renderAgent(makeAgent())
    const detailPane = screen.getByRole('region', { name: 'Detall' })
    const timelinePane = screen.getByRole('region', { name: 'Cronologia' })

    // Per defecte, vista de detall.
    expect(detailPane).toHaveAttribute('data-active', 'true')
    expect(timelinePane).toHaveAttribute('data-active', 'false')
    expect(screen.getByText('Canals')).toBeInTheDocument()
    expect(screen.getByTestId('agent-timeline-stub')).toBeInTheDocument()

    // Exact name: the section toggle "Cronologia d'avui" is also a button now.
    fireEvent.click(screen.getByRole('button', { name: 'Cronologia' }))
    expect(detailPane).toHaveAttribute('data-active', 'false')
    expect(timelinePane).toHaveAttribute('data-active', 'true')
  })

  it('assignar des de la palette crida mutate amb la nova skill', () => {
    useCapabilitiesMock.mockReturnValue({ canChangeSkills: true } as Capabilities)
    renderAgent(makeAgent())
    fireEvent.click(screen.getByRole('button', { name: /afegeix skill/i }))
    fireEvent.click(screen.getByText('Suport tècnic'))
    const [vars, opts] = mutateMock.mock.calls[0]
    expect(vars).toEqual({ agentId: 'a1', changes: [{ skillId: 'sk2' }] })
    expect(typeof opts.onSuccess).toBe('function')
    expect(typeof opts.onError).toBe('function')
  })
})

describe('AgentDetail — cues assignades', () => {
  beforeEach(() => {
    queryClient = makeQueryClient()
    useCapabilitiesMock.mockReturnValue(null)
    useSkillsMock.mockReturnValue(makeSkillCatalog())
  })

  it('llegeix cada cua de la caché per id, sense la col·lecció sencera', () => {
    queryClient.setQueryData(entityKey('salesforce', 'queue', 'q1'), {
      id: 'q1',
      name: 'Suport N1',
      backlog: 4,
      online: 2,
    })
    queryClient.setQueryData(entityKey('salesforce', 'queue', 'q2'), {
      id: 'q2',
      name: 'Retencions',
      backlog: 0,
      online: 1,
    })

    renderAgent(makeAgent({ queueIds: ['q1', 'q2'] }))

    expect(screen.getByText('Suport N1')).toBeInTheDocument()
    expect(screen.getByText('Retencions')).toBeInTheDocument()
  })

  it('omet les cues que no són a la caché en comptes de trencar la llista', () => {
    queryClient.setQueryData(entityKey('salesforce', 'queue', 'q1'), {
      id: 'q1',
      name: 'Suport N1',
      backlog: 4,
      online: 2,
    })

    renderAgent(makeAgent({ queueIds: ['q1', 'fantasma'] }))

    expect(screen.getByText('Suport N1')).toBeInTheDocument()
    expect(screen.queryByText('fantasma')).not.toBeInTheDocument()
  })
})
