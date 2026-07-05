import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'
import { AppIcon } from './AppIcon'

export interface ActionMenuItem {
  key: string
  label: string
  /** Optional leading glyph (SfIcon, inline svg, …). */
  icon?: ReactNode
  onSelect: () => void
  /** Renders the item in the alert colour (e.g. delete). */
  danger?: boolean
  disabled?: boolean
  /** When set, renders a trailing on/off marker for toggle actions. */
  checked?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  /** Accessible name + tooltip for the kebab trigger. */
  label?: string
  /** Extra class for the trigger button (defaults to the sidebar mini-button). */
  triggerClassName?: string
}

/** Rough per-item height (padding + line) used to decide up/down flip before the
    panel is measured — good enough to keep the menu on-screen. */
const ITEM_H = 34

const Kebab = () => <AppIcon name="threedots_vertical" size={16} />

/** A kebab trigger that opens a dropdown of actions. The panel is portalled to
    <body> and fixed-positioned from the trigger's rect, so it escapes the tree's
    scroll clipping. Closes on outside click, Escape, or any scroll. */
export function ActionMenu({ items, label = 'Accions', triggerClassName = 'fe-mini-btn' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ right: number; top?: number; bottom?: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared open/close animation (adds/removes `is-open`, toggles `hidden`).
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  // Close on outside click, Escape, or any scroll (the fixed panel can't follow).
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || dropRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onScroll() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const margin = 6
    const estHeight = items.length * ITEM_H + 12
    const right = Math.max(8, window.innerWidth - rect.right)
    const spaceBelow = window.innerHeight - rect.bottom
    // Flip up only when there isn't room below and there is more room above.
    setCoords(
      spaceBelow < estHeight && rect.top > spaceBelow
        ? { right, bottom: window.innerHeight - rect.top + margin }
        : { right, top: rect.bottom + margin },
    )
    setOpen(true)
  }

  const panelStyle: CSSProperties = coords
    ? {
        position: 'fixed',
        right: coords.right,
        ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }),
        zIndex: 300,
      }
    : { position: 'fixed', visibility: 'hidden' }

  return (
    <div className="fe-action-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
      >
        <Kebab />
      </button>
      {createPortal(
        <div
          ref={dropRef}
          className="fe-action-menu__drop dropdown-panel"
          role="menu"
          hidden
          style={panelStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`fe-action-menu__item${item.danger ? ' fe-action-menu__item--danger' : ''}`}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon ? <span className="fe-action-menu__icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="fe-action-menu__label">{item.label}</span>
              {item.checked != null ? (
                <span className={`fe-action-menu__check${item.checked ? ' is-on' : ''}`} aria-hidden="true">
                  {item.checked ? '◉' : '○'}
                </span>
              ) : null}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
