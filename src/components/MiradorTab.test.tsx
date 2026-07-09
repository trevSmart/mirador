import { describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import type { IDockviewDefaultTabProps } from 'dockview-react'
import { MiradorTab } from './MiradorTab'

/* Fake mínim de l'API de panell de dockview: títol mutable + emitter
   d'onDidTitleChange, que és tot el que MiradorTab consumeix. */
function createFakePanelApi(initialTitle: string) {
  let title = initialTitle
  const listeners = new Set<(event: { title: string }) => void>()
  return {
    id: 'detail-work-w1',
    get title() {
      return title
    },
    isActive: false,
    setTitle(next: string) {
      title = next
      for (const listener of listeners) {
        listener({ title: next })
      }
    },
    onDidTitleChange(listener: (event: { title: string }) => void) {
      listeners.add(listener)
      return { dispose: () => listeners.delete(listener) }
    },
    close: () => {},
  }
}

function renderTab(api: ReturnType<typeof createFakePanelApi>, before?: React.ReactNode) {
  const props = {
    api,
    containerApi: { panels: [] },
  } as unknown as IDockviewDefaultTabProps
  return render(
    <>
      {before}
      <MiradorTab {...props} />
    </>,
  )
}

describe('MiradorTab', () => {
  it('renders the panel title and follows onDidTitleChange', () => {
    const api = createFakePanelApi('Treball')
    renderTab(api)
    expect(screen.getByText('Treball')).toBeInTheDocument()
  })

  it('shows the current title even when it changed before the tab subscribed', () => {
    /* Reprodueix la cursa del refresh: el DetailPanel (germà anterior en
       l'arbre) corregeix el títol dins del seu efecte ABANS que MiradorTab
       subscrigui onDidTitleChange, així que el canvi no genera cap event
       observable pel tab i cal resincronitzar en subscriure. */
    const api = createFakePanelApi('Treball')
    function TitleStomper() {
      useEffect(() => {
        api.setTitle('Email incidència crítica')
      }, [])
      return null
    }
    renderTab(api, <TitleStomper />)
    expect(screen.getByText('Email incidència crítica')).toBeInTheDocument()
    expect(screen.queryByText('Treball')).toBeNull()
  })
})
