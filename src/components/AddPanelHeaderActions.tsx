import { useEffect, useRef, useState } from 'react'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { appNavigator } from '../navigation/app-navigator'
import { PanelIcon } from '../panels/PanelIcon'
import { getPanelDefinition, PANEL_MENU_GROUPS, type PanelType } from '../panels/registry'
import { syncDropdownPanel } from '../utils/sync-dropdown-panel'

export function AddPanelHeaderActions(props: IDockviewHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate open/close with the shared dropdown helper.
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, isOpen, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [isOpen])

  // Focus trap: move focus into the modal on open, cycle Tab within it,
  // and restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        triggerRef.current?.focus()
      }
      return
    }
    wasOpenRef.current = true
    const drop = dropRef.current
    if (!drop) return

    const getItems = () =>
      Array.from(drop.querySelectorAll<HTMLElement>('button:not([disabled])'))

    getItems()[0]?.focus()

    function handleTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !drop) return
      const items = getItems()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !drop.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !drop.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (props.location?.type === 'edge') {
    return null
  }

  const handleToggle = () => {
    setIsOpen((value) => !value)
  }

  const handleAddPanel = (type: PanelType) => {
    appNavigator.openPanel(type)
    setIsOpen(false)
  }

  return (
    <div className="add-panel-control" ref={menuRef}>
      <button
        ref={triggerRef}
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
        className={`ui-scrim${isOpen ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
      />
      <div
        ref={dropRef}
        className="add-panel-control__dropdown dropdown-panel"
        role="menu"
        hidden
      >
        {PANEL_MENU_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label} className="add-panel-control__group">
            <div className="add-panel-control__group-label" aria-hidden="true">
              {group.label}
            </div>
            {group.types.map((type) => {
              const panel = getPanelDefinition(type)
              return (
                <button
                  key={panel.type}
                  type="button"
                  role="menuitem"
                  className="add-panel-control__item"
                  onClick={() => handleAddPanel(panel.type)}
                >
                  <span className="add-panel-control__item-icon">
                    <PanelIcon type={panel.type} sldsSize="medium" />
                  </span>
                  <span className="add-panel-control__item-text">
                    <span className="add-panel-control__item-title">{panel.title}</span>
                    <span className="add-panel-control__item-desc">{panel.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
