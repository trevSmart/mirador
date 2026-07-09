import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, AgentTimeline as AgentTimelineData } from '../../api/types'

// The Data Service hook is the only external dependency — stub it per-test.
const useEntityMock = vi.fn()
vi.mock('../../api/data-service', () => ({
  agentTimelineResource: { source: 'salesforce', entity: 'agentTimeline' },
  useEntity: (...args: unknown[]) => useEntityMock(...args),
}))

import { AgentTimeline } from './AgentTimeline'

const NOW = new Date(2026, 6, 9, 13, 0, 0, 0).getTime()
const day = new Date(2026, 6, 9, 0, 0, 0, 0).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const HOUR = 3_600_000

const agent = { id: '005mock00000001AAA', name: 'Núria' } as Agent

function fixture(): AgentTimelineData {
  return {
    agentId: agent.id,
    day: '2026-07-09',
    presence: [
      {
        id: 'p1',
        start: iso(day + 9 * HOUR),
        end: iso(day + 11 * HOUR),
        label: 'Disponible',
        status: 'online',
        presenceLabel: 'Disponible',
      },
      {
        id: 'p2',
        start: iso(day + 11 * HOUR),
        end: null,
        label: 'En pausa',
        status: 'away',
        presenceLabel: 'En pausa',
      },
    ],
    work: [
      {
        id: 'w1',
        start: iso(day + 12 * HOUR + 30 * 60_000),
        end: null,
        label: 'Cas #48312',
        channelKey: 'cas',
        recordId: null,
        queue: 'Incidències',
      },
    ],
  }
}

describe('AgentTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    useEntityMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders presence bands, work bars and a now marker', () => {
    useEntityMock.mockReturnValue({ data: fixture(), isLoading: false })
    const { container } = render(<AgentTimeline agent={agent} />)

    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('En pausa')).toBeInTheDocument()
    expect(screen.getByText('Cas #48312')).toBeInTheDocument()
    expect(container.querySelector('.dd-tl__now')).not.toBeNull()
    expect(container.querySelectorAll('.dd-tl__band')).toHaveLength(2)
    expect(container.querySelectorAll('.dd-tl__bar')).toHaveLength(1)
  })

  it('lists carry-over work (opened before today, still open) instead of drawing bars', () => {
    const data = fixture()
    // A case opened yesterday, still open — shown in the carry-over list, not
    // as a full-width lane on today's axis.
    data.work.push({
      id: 'w-old',
      start: iso(day - 20 * HOUR),
      end: null,
      label: 'Cas antic',
      channelKey: 'cas',
      recordId: null,
      queue: null,
    })
    useEntityMock.mockReturnValue({ data, isLoading: false })
    const { container } = render(<AgentTimeline agent={agent} />)

    // Only today's bar is drawn; the carry-over appears in the compact list.
    expect(container.querySelectorAll('.dd-tl__bar')).toHaveLength(1)
    expect(container.querySelector('.dd-tl__carry-item')).not.toBeNull()
    expect(screen.getByText('Cas antic')).toBeInTheDocument()
    expect(screen.getByText(/en curs des d.abans d.avui · 1/i)).toBeInTheDocument()
  })

  it('collapses multiple AgentWork rows for the same record into one bar', () => {
    const data = fixture()
    data.work = [
      {
        id: 'aw1',
        start: iso(day + 10 * HOUR),
        end: iso(day + 10 * HOUR + 20 * 60_000),
        label: 'Cas 500X',
        channelKey: 'cas',
        recordId: '500X',
        queue: null,
      },
      {
        id: 'aw2', // re-route of the same case → same recordId
        start: iso(day + 11 * HOUR),
        end: null,
        label: 'Cas 500X',
        channelKey: 'cas',
        recordId: '500X',
        queue: null,
      },
    ]
    useEntityMock.mockReturnValue({ data, isLoading: false })
    const { container } = render(<AgentTimeline agent={agent} />)
    expect(container.querySelectorAll('.dd-tl__bar')).toHaveLength(1)
  })

  it('shows an empty hint when there is no activity', () => {
    useEntityMock.mockReturnValue({
      data: { agentId: agent.id, day: '2026-07-09', presence: [], work: [] },
      isLoading: false,
    })
    render(<AgentTimeline agent={agent} />)
    expect(screen.getByText(/sense activitat registrada/i)).toBeInTheDocument()
  })

  it('shows a loading state while fetching', () => {
    useEntityMock.mockReturnValue({ data: undefined, isLoading: true })
    render(<AgentTimeline agent={agent} />)
    expect(screen.getByText(/carregant cronologia/i)).toBeInTheDocument()
  })
})
