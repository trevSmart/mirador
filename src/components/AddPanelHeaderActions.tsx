import { useEffect, useRef, useState } from 'react'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { addPanelByType } from '../panels/panel-actions'
import { PanelIcon } from '../panels/PanelIcon'
import { PANEL_DEFINITIONS, type PanelType } from '../panels/registry'
import { syncDropdownPanel } from '../utils/sync-dropdown-panel'

export function AddPanelHeaderActions(props: IDockviewHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate open/close with the shared dropdown helper.
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, isOpen, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (props.location?.type === 'edge') {
    return null
  }

  const handleToggle = () => {
    setIsOpen((value) => !value)
  }

  const handleAddPanel = (type: PanelType) => {
    addPanelByType(props.containerApi, type)
    setIsOpen(false)
  }

  return (
    <div className="add-panel-control" ref={menuRef}>
      <button
        type="button"
        className="add-panel-control__action"
        title="Afegir panell"
        aria-label="Afegir panell"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={handleToggle}
      >
        +
      </button>
      <div
        ref={dropRef}
        className="add-panel-control__dropdown dropdown-panel"
        role="menu"
        hidden
      >
        {PANEL_DEFINITIONS.map((panel) => (
          <button
            key={panel.type}
            type="button"
            role="menuitem"
            className="add-panel-control__item"
            onClick={() => handleAddPanel(panel.type)}
          >
            <PanelIcon type={panel.type} sldsSize="x-small" />
            {panel.title}
          </button>
        ))}
      </div>
    </div>
  )
}
