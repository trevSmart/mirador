import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent } from '../api/types'

// Referències estables: els hooks reals retornen dades cachejades, i si cada
// render retornés arrays nous es re-computaria el memo d'items i emmascararia
// el bug d'estalitat que es vol reproduir.
const useAgentsMock = vi.fn<() => Agent[]>(() => [])
const EMPTY_QUEUES: never[] = []
const EMPTY_SKILLS: never[] = []
vi.mock('../api/data-hooks', () => ({
  useAgents: () => useAgentsMock(),
  useQueues: () => EMPTY_QUEUES,
  useSkills: () => EMPTY_SKILLS,
}))

const openAgent = vi.fn()
vi.mock('../detail/detail-drawer-context', () => ({
  useDetailDrawer: () => ({
    openAgent,
    openQueue: vi.fn(),
    openSkill: vi.fn(),
  }),
}))

vi.mock('../hooks/useSalesforcePhoto', () => ({
  useSalesforcePhoto: () => null,
}))

import { GlobalSearch } from './GlobalSearch'
import { recordDetailOpen } from '../utils/detail-recent-store'

// JSDOM no implementa matchMedia (syncContentHeight consulta reduced-motion)
// ni scrollIntoView (auto-scroll de la fila activa).
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
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}

function makeAgent(id: string, name: string): Agent {
  return {
    id,
    name,
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
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skills: [],
  }
}

function seedRecents(entries: Array<{ kind: string; id: string; title: string }>) {
  localStorage.setItem(
    'mirador.detailRecents.v1',
    JSON.stringify(entries.map((entry, i) => ({ ...entry, meta: '', viewedAt: 1000 - i }))),
  )
}

describe('GlobalSearch — recents i navegació per teclat', () => {
  beforeEach(() => {
    localStorage.clear()
    openAgent.mockClear()
    useAgentsMock.mockReturnValue([makeAgent('a1', 'Anna'), makeAgent('a2', 'Berta')])
  })

  it('la fila destacada i el registre obert coincideixen després d’un open extern', () => {
    // Un recent previ perquè la llista de teclat (memo) ja tingui contingut.
    seedRecents([{ kind: 'agent', id: 'a1', title: 'Anna' }])
    render(<GlobalSearch />)

    // Obertura d'un detall des de FORA de la cerca (fila d'agent, cross-link…):
    // escriu al store sense passar per handleSelect.
    act(() => {
      recordDetailOpen({ kind: 'agent', id: 'a2' })
    })

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // La primera fila renderitzada (i destacada) és el recent més nou: Berta.
    const highlighted = document.querySelector('.qsearch-item.on')
    expect(highlighted?.textContent).toContain('Berta')

    fireEvent.keyDown(input, { key: 'Enter' })

    // Invariant: s'obre exactament el registre destacat.
    expect(openAgent).toHaveBeenCalledTimes(1)
    expect(openAgent).toHaveBeenCalledWith('a2')
  })

  it('un open extern amb recents inicialment buits és seleccionable per teclat', () => {
    render(<GlobalSearch />)

    act(() => {
      recordDetailOpen({ kind: 'agent', id: 'a1' })
    })

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByText('Anna')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(openAgent).toHaveBeenCalledTimes(1)
    expect(openAgent).toHaveBeenCalledWith('a1')
  })
})
