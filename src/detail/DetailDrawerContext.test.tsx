import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { entityKey, makeQueryClient } from '../api/data-service'

const recordDetailOpen = vi.fn<(entry: unknown) => void>()
vi.mock('../utils/detail-recent-store', () => ({
  recordDetailOpen: (entry: unknown) => recordDetailOpen(entry),
}))

vi.mock('../modals/useRegisterModal', () => ({
  useRegisterModal: () => {},
}))

const openDetail = vi.fn<(target: unknown, title: string) => boolean>(() => true)
vi.mock('../navigation/app-navigator', () => ({
  appNavigator: {
    openDetail: (target: unknown, title: string) => openDetail(target, title),
  },
}))

import { DetailDrawerProvider } from './DetailDrawerContext'
import { useDetailDrawer } from './detail-drawer-context'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DetailDrawerProvider>{children}</DetailDrawerProvider>
    </QueryClientProvider>
  )
}

function renderDrawer() {
  return renderHook(useDetailDrawer, { wrapper })
}

beforeEach(() => {
  queryClient = makeQueryClient()
  recordDetailOpen.mockClear()
  openDetail.mockClear()
  openDetail.mockReturnValue(true)
})

describe('DetailDrawerProvider — pila de drilldown', () => {
  it('obrir amb el drawer tancat no apila res', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
    expect(result.current.canGoBack).toBe(false)
  })

  it('el drilldown apila el target anterior i back hi torna', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))

    expect(result.current.detail).toEqual({ kind: 'queue', id: 'q1' })
    expect(result.current.canGoBack).toBe(true)

    act(() => result.current.back())

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
    expect(result.current.canGoBack).toBe(false)
  })

  it('el drilldown encadenat es desfà en ordre invers', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))
    act(() => result.current.openWork('w1'))

    act(() => result.current.back())
    expect(result.current.detail).toEqual({ kind: 'queue', id: 'q1' })

    act(() => result.current.back())
    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
    expect(result.current.canGoBack).toBe(false)
  })

  it('re-obrir el target actual és un no-op (ni apila ni re-registra el recent)', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    recordDetailOpen.mockClear()

    act(() => result.current.openAgent('a1'))

    expect(result.current.canGoBack).toBe(false)
    expect(recordDetailOpen).not.toHaveBeenCalled()
  })

  it('close tanca i buida la pila', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))
    act(() => result.current.close())

    expect(result.current.detail).toBeNull()

    act(() => result.current.openSkill('s1'))

    expect(result.current.canGoBack).toBe(false)
  })

  it('back deixa el target actual disponible per a forward', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))

    expect(result.current.canGoForward).toBe(false)

    act(() => result.current.back())

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
    expect(result.current.canGoForward).toBe(true)

    act(() => result.current.forward())

    expect(result.current.detail).toEqual({ kind: 'queue', id: 'q1' })
    expect(result.current.canGoBack).toBe(true)
    expect(result.current.canGoForward).toBe(false)
  })

  it('obrir un target nou després de back descarta la branca forward', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))
    act(() => result.current.back())
    act(() => result.current.openWork('w1'))

    expect(result.current.canGoForward).toBe(false)

    act(() => result.current.back())

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
  })

  it('forward amb la pila buida és un no-op', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.forward())

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
  })

  it('back amb la pila buida és un no-op', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.back())

    expect(result.current.detail).toEqual({ kind: 'agent', id: 'a1' })
  })

  it('openAsTab amb èxit tanca el drawer i buida la pila', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))
    act(() => result.current.openAsTab({ kind: 'queue', id: 'q1' }))

    expect(result.current.detail).toBeNull()

    act(() => result.current.openAgent('a2'))

    expect(result.current.canGoBack).toBe(false)
  })

  it('openAsTab fallit manté el drawer i la pila', () => {
    openDetail.mockReturnValue(false)
    const { result } = renderDrawer()

    act(() => result.current.openAgent('a1'))
    act(() => result.current.openQueue('q1'))
    act(() => result.current.openAsTab({ kind: 'queue', id: 'q1' }))

    expect(result.current.detail).toEqual({ kind: 'queue', id: 'q1' })
    expect(result.current.canGoBack).toBe(true)
  })
})

describe('DetailDrawerProvider — títol de la pestanya', () => {
  it('el treu de la caché del Data Service, sense subscriure-s\'hi', () => {
    queryClient.setQueryData(entityKey('salesforce', 'queue', 'q1'), {
      id: 'q1',
      name: 'Suport N1',
    })
    const { result } = renderDrawer()

    act(() => result.current.openAsTab({ kind: 'queue', id: 'q1' }))

    expect(openDetail).toHaveBeenCalledWith({ kind: 'queue', id: 'q1' }, 'Suport N1')
    expect(recordDetailOpen).toHaveBeenCalledWith({
      kind: 'queue',
      id: 'q1',
      name: 'Suport N1',
    })
  })

  it('un work item es titula amb el subject, no amb el name', () => {
    queryClient.setQueryData(entityKey('salesforce', 'workItem', 'w1'), {
      id: 'w1',
      subject: 'Factura duplicada',
    })
    const { result } = renderDrawer()

    act(() => result.current.openAsTab({ kind: 'work', id: 'w1' }))

    expect(openDetail).toHaveBeenCalledWith(
      { kind: 'work', id: 'w1' },
      'Factura duplicada',
    )
  })

  it('cau al títol genèric quan el registre no és a la caché', () => {
    const { result } = renderDrawer()

    act(() => result.current.openAsTab({ kind: 'agent', id: 'a-desconegut' }))

    expect(openDetail).toHaveBeenCalledWith(
      { kind: 'agent', id: 'a-desconegut' },
      'Agent',
    )
  })
})
