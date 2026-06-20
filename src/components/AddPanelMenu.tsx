import { useEffect, useRef, useState } from 'react'
import type { DockviewShellHandle } from './DockviewShell'
import { PANEL_DEFINITIONS, type PanelType } from '../panels/registry'

interface AddPanelMenuProps {
  dockviewRef: React.RefObject<DockviewShellHandle | null>
}

export function AddPanelMenu({ dockviewRef }: AddPanelMenuProps) {
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

  const refreshOpenTypes = () => {
    const types = dockviewRef.current?.getOpenPanelTypes() ?? []
    setOpenTypes(types)
  }

  const handleToggle = () => {
    refreshOpenTypes()
    setIsOpen((value) => !value)
  }

  const handleAddPanel = (type: PanelType) => {
    dockviewRef.current?.addPanel(type)
    refreshOpenTypes()
    setIsOpen(false)
  }

  return (
    <div className="add-panel-menu" ref={menuRef}>
      <button type="button" className="add-panel-menu__trigger" onClick={handleToggle}>
        + Afegir panell
      </button>
      {isOpen ? (
        <div className="add-panel-menu__dropdown" role="menu">
          {PANEL_DEFINITIONS.map((panel) => {
            const isDisabled = openTypes.includes(panel.type)
            return (
              <button
                key={panel.type}
                type="button"
                role="menuitem"
                className="add-panel-menu__item"
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
