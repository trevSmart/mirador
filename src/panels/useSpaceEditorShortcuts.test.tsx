import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DockviewPanelApi } from 'dockview-react'
import { TOOL_ORDER } from '../components/space/space-tools'
import { ModalRegistryContext } from '../modals/modal-registry-context'
import { useSpaceEditorShortcuts } from './useSpaceEditorShortcuts'

/* Harness mínim: només munta el hook amb un api de panell fals. Dockview manté
   els tabs inactius muntats, així que el hook ha de decidir en temps d'event
   (api.isActive + registre de modals), no en temps de muntatge. */
function Harness({
  api,
  actions,
}: {
  api: DockviewPanelApi
  actions: Parameters<typeof useSpaceEditorShortcuts>[1]
}) {
  useSpaceEditorShortcuts(api, actions)
  return <input aria-label="camp de text" />
}

function renderShortcuts({ isActive = true, modalOpen = false } = {}) {
  const actions = { setTool: vi.fn(), undo: vi.fn(), redo: vi.fn() }
  /* Fake mínim de l'API de panell de dockview: el hook només llegeix isActive. */
  const api = { isActive } as unknown as DockviewPanelApi
  render(
    <ModalRegistryContext.Provider
      value={{ isAnyModalOpen: () => modalOpen, setModalState: () => {} }}
    >
      <Harness api={api} actions={actions} />
    </ModalRegistryContext.Provider>,
  )
  return actions
}

describe('useSpaceEditorShortcuts', () => {
  it('runs the shortcuts while the panel is active and no modal is open', () => {
    const actions = renderShortcuts()
    fireEvent.keyDown(window, { key: '3' })
    expect(actions.setTool).toHaveBeenCalledWith(TOOL_ORDER[2])
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(actions.undo).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    expect(actions.redo).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the panel is not the active dockview panel', () => {
    const actions = renderShortcuts({ isActive: false })
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })
    expect(actions.setTool).not.toHaveBeenCalled()
    expect(actions.undo).not.toHaveBeenCalled()
    expect(actions.redo).not.toHaveBeenCalled()
  })

  it('does nothing while a modal is open', () => {
    const actions = renderShortcuts({ modalOpen: true })
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(actions.setTool).not.toHaveBeenCalled()
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it('keeps ignoring keystrokes typed into text fields', () => {
    const actions = renderShortcuts()
    fireEvent.keyDown(screen.getByLabelText('camp de text'), { key: '3' })
    expect(actions.setTool).not.toHaveBeenCalled()
  })
})
