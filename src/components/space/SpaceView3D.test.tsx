import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SpaceView3D } from './SpaceView3D'
import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import type { Agent } from '../../api/types'
import type { Space } from '../../space/types'

// JSDOM may lack matchMedia (used by useTowerHeightScale's reduced-motion
// check); stub it so seat towers mount.
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// Avatar photos go through useSalesforcePhoto → useAuth, which throws without
// a provider. A null, logged-out stub is enough (photo is null anyway).
const authStub: AuthContextValue = {
  config: null,
  session: null,
  userInfo: null,
  isAuthenticated: false,
  isMockMode: true,
  isServerMockMode: true,
  isSalesforceEnabled: false,
  isLoading: false,
  authError: null,
  login: async () => {},
  logout: () => {},
}

function makeAgent(): Agent {
  return {
    id: 'a1',
    name: 'Aina Serra',
    role: 'Agent',
    recordUrl: null,
    status: 'online',
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: 4,
    used: 2,
    queueIds: [],
    loginMin: 0,
    photo: null,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skills: [],
  }
}

function makeSpace(): Space {
  // 2×2 room, one seated agent, one window on a visible back (N) edge so a
  // daylight beam volume renders.
  return {
    id: 's1',
    name: 'Test',
    dir: 0,
    active: true,
    cells: [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
    ],
    seats: [{ c: 0, r: 1, agentId: 'a1' }],
    dividers: [],
    openings: [{ c: 1, r: 0, edge: 'N', kind: 'window' }],
  }
}

/** True when `b` comes after `a` in document order (SVG paints in doc order). */
function paintsAfter(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

function renderView() {
  const agent = makeAgent()
  const { container } = render(
    <AuthContext.Provider value={authStub}>
      <SpaceView3D
        space={makeSpace()}
        agentsById={new Map([[agent.id, agent]])}
        queuesById={new Map()}
        showAvatars={false}
        animations={false}
        onSelectAgent={() => {}}
        showTooltip={false}
      />
    </AuthContext.Provider>,
  )
  const beam = container.querySelector('g[filter*="beam-blur"]')
  const seat = container.querySelector('g.fv3d-seat')
  expect(beam).not.toBeNull()
  expect(seat).not.toBeNull()
  return { container, beam: beam as Element, seat: seat as Element }
}

describe('SpaceView3D daylight beam layering', () => {
  it('paints sunbeams below seats/towers (beam layer precedes seats in document order)', () => {
    const { beam, seat } = renderView()
    expect(paintsAfter(beam, seat)).toBe(true)
  })

  it('paints sunbeams above the floor tiles (beams are not buried under the opaque floor)', () => {
    const { container, beam } = renderView()
    const tiles = container.querySelectorAll('polygon[fill="#FDFCFB"], polygon[fill="#FBFAF8"]')
    expect(tiles.length).toBe(4)
    for (const tile of tiles) {
      expect(paintsAfter(tile, beam)).toBe(true)
    }
  })
})
