import { useEffect } from 'react'
import type { DockviewPanelApi } from 'dockview-react'
import { TOOL_ORDER } from '../components/space/space-tools'
import { useModalRegistry } from '../modals/modal-registry-context'
import type { SpaceTool } from '../space/types'

interface SpaceEditorShortcutActions {
  setTool: (tool: SpaceTool) => void
  undo: () => void
  redo: () => void
}

/** Keyboard shortcuts for the Space editor: 1–7 pick a tool (palette order),
 *  ⌘/Ctrl+Z undoes, ⇧⌘/Ctrl+Z redoes. Ignored while typing.
 *
 *  Dockview keeps inactive tabs mounted, so the listener outlives the tab
 *  being visible: every event checks api.isActive and the modal registry
 *  (like GlobalShortcutsProvider) before acting, otherwise ⌘Z from another
 *  tab or under a modal would silently undo space-plan edits. */
export function useSpaceEditorShortcuts(
  api: DockviewPanelApi,
  { setTool, undo, redo }: SpaceEditorShortcutActions,
) {
  const { isAnyModalOpen } = useModalRegistry()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!api.isActive || isAnyModalOpen()) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const digit = Number.parseInt(event.key, 10)
      if (digit >= 1 && digit <= TOOL_ORDER.length) {
        setTool(TOOL_ORDER[digit - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [api, isAnyModalOpen, setTool, undo, redo])
}
