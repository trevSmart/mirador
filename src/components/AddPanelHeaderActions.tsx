import { useEffect, useRef, useState } from 'react'
import type { IDockviewHeaderActionsProps } from 'dockview'
import { addPanelByType, getOpenPanelTypes } from '../panels/panel-actions'
import { PANEL_DEFINITIONS, type PanelType } from '../panels/registry'

export function AddPanelHeaderActions(props: IDockviewHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openTypes, setOpenTypes] = useState<PanelType[]>(['home'])
  const menuRef = useRef<HTMLDivElement>(null)

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

  const refreshOpenTypes = () => {
    setOpenTypes(getOpenPanelTypes(props.containerApi))
  }

  const handleToggle = () => {
    refreshOpenTypes()
    setIsOpen((value) => !value)
  }

  const handleAddPanel = (type: PanelType) => {
    addPanelByType(props.containerApi, type)
    refreshOpenTypes()
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
      {isOpen ? (
        <div className="add-panel-control__dropdown" role="menu">
          {PANEL_DEFINITIONS.map((panel) => {
            const isDisabled = openTypes.includes(panel.type)
            return (
              <button
                key={panel.type}
                type="button"
                role="menuitem"
                className="add-panel-control__item"
                disabled={isDisabled}
                onClick={() => handleAddPanel(panel.type)}
              >
                {panel.title}
                {isDisabled ? ' (obert)' : ''}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
