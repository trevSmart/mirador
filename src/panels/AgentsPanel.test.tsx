import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { DockviewApi, IDockviewPanelProps } from 'dockview-react'
import { AuthContext, type AuthContextValue } from '../auth/auth-context'
import type { Agent, PresenceStatusOption } from '../api/types'
import { CONNECTED_FILTER } from '../utils/agent-presence-filter'

const useAgentsMock = vi.fn<() => Agent[]>(() => [])
const usePresenceStatusesMock = vi.fn<() => PresenceStatusOption[]>(() => [])
vi.mock('../api/data-hooks', () => ({
  useAgents: () => useAgentsMock(),
  usePresenceStatuses: () => usePresenceStatusesMock(),
  useDataStatus: () => ({
    isLoading: false,
    isRefreshing: false,
    error: null,
    dataUpdatedAt: 1,
    refresh: vi.fn(),
  }),
}))

// Stub the card so the suite stays focused on the filter-adoption behaviour.
vi.mock('../components/AgentCard', () => ({
  AgentCard: ({ agent }: { agent: Agent }) => <div data-testid="agent-card">{agent.name}</div>,
}))

import { AgentsPanel } from './AgentsPanel'
import { addPanelByType } from './panel-actions'

// JSDOM no implementa matchMedia; PanelShell el consulta per reduced-motion.
// matches: true fa que no s'instanciï Lenis dins el test.
window.matchMedia = (query: string) => ({
  matches: true,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}) as MediaQueryList

function makeAgent(overrides: Partial<Agent>): Agent {
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

/** Roster fixe: dos agents connectats (amb presència) i un de desconnectat. */
function seedRoster() {
  useAgentsMock.mockReturnValue([
    makeAgent({ id: 'a1', name: 'Marta', presenceStatusId: 'p1', presenceStatusLabel: 'Disponible' }),
    makeAgent({ id: 'a2', name: 'Joan', presenceStatusId: 'p1', presenceStatusLabel: 'Disponible' }),
    makeAgent({ id: 'a3', name: 'Núria', status: 'offline' }),
  ])
  usePresenceStatusesMock.mockReturnValue([{ id: 'p1', label: 'Disponible' }])
}

/* ── Fake mínim d'un panell Agents ja obert a Dockview ─────────────────────
   Prou fidel perquè addPanelByType real trobi el panell existent i faci el
   push de paràmetres via updateParameters (que fusiona, com fa Dockview). */
function createOpenAgentsPanel() {
  const panel = {
    id: 'agents-1',
    params: undefined as Record<string, unknown> | undefined,
    view: { contentComponent: 'agents' },
    api: {
      setActive: () => {},
      updateParameters: (params: Record<string, unknown>) => {
        panel.params = { ...panel.params, ...params }
      },
    },
  }
  const api = { panels: [panel] } as unknown as DockviewApi
  return { api, panel }
}

const auth = { isMockMode: true } as AuthContextValue

function panelElement(params: Record<string, unknown> | undefined): ReactNode {
  const props = { params } as unknown as IDockviewPanelProps
  return (
    <AuthContext.Provider value={auth}>
      <AgentsPanel {...props} />
    </AuthContext.Provider>
  )
}

describe('AgentsPanel — adopció del filtre entrant', () => {
  it('adopta el filtre de Home i el torna a adoptar encara que el valor es repeteixi', () => {
    seedRoster()
    const { api, panel } = createOpenAgentsPanel()

    // Panell obert directament (sense params): roster complet.
    const view = render(panelElement(panel.params))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(3)

    // Home: clic a «Veure tots» amb el xip «Connectats» actiu.
    addPanelByType(api, 'agents', { presenceFilter: CONNECTED_FILTER })
    view.rerender(panelElement(panel.params))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2)

    // L'usuari canvia el filtre local a «Tots».
    fireEvent.click(screen.getByRole('button', { name: /^tots/i }))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(3)

    // Home torna a enviar el MATEIX valor: també s'ha d'adoptar.
    addPanelByType(api, 'agents', { presenceFilter: CONNECTED_FILTER })
    view.rerender(panelElement(panel.params))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2)
  })

  it('adopta un valor diferent enviat més tard (comportament existent)', () => {
    seedRoster()
    const { api, panel } = createOpenAgentsPanel()

    addPanelByType(api, 'agents', { presenceFilter: CONNECTED_FILTER })
    const view = render(panelElement(panel.params))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2)

    addPanelByType(api, 'agents', { presenceFilter: 'p1' })
    view.rerender(panelElement(panel.params))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /^tots/i }))
    expect(screen.getAllByTestId('agent-card')).toHaveLength(3)
  })
})
