import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'

export type SelectOption<T extends string | number> = { value: T; label: string }

export interface SelectProps<T extends string | number> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Accessible name; mirrors the old <select aria-label>. */
  ariaLabel: string
  disabled?: boolean
  /** Extra class on the trigger (keeps existing visual sizing, e.g. 'fv-select'). */
  className?: string
  /** Optional min-width in px applied to trigger and panel. */
  minWidth?: number
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
  minWidth,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [alignEnd, setAlignEnd] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedIndex = options.findIndex((o) => o.value === value)

  // Animate open/close with the shared helper. On open, decide whether the
  // panel must align to the right edge of the trigger because there isn't
  // enough room to expand rightwards within the viewport.
  useEffect(() => {
    if (open) {
      const root = rootRef.current
      const panel = dropRef.current
      if (root && panel) {
        const triggerLeft = root.getBoundingClientRect().left
        // The panel is at least as wide as the trigger (min-width: 100%);
        // measure its natural width while still hidden.
        const panelWidth = Math.max(panel.scrollWidth, root.offsetWidth)
        const margin = 8
        const overflowsRight =
          triggerLeft + panelWidth > window.innerWidth - margin
        // Only flip if aligning to the right actually keeps it on-screen.
        const fitsWhenAlignedEnd =
          triggerLeft + root.offsetWidth - panelWidth >= margin
        setAlignEnd(overflowsRight && fitsWhenAlignedEnd)
      }
    }
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  // Helper: set highlight to current value then open.
  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const commit = (index: number) => {
    const opt = options[index]
    if (opt) onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return
    switch (event.key) {
      case 'Escape':
        setOpen(false)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) commit(activeIndex)
        else openMenu()
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!open) openMenu()
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (open) setActiveIndex((i) => Math.max(i - 1, 0))
        break
      default:
        break
    }
  }

  const style = minWidth ? { minWidth: `${minWidth}px` } : undefined

  return (
    <div className="ds-select" ref={rootRef}>
      <button
        type="button"
        className={`ds-select__trigger${className ? ` ${className}` : ''}`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="ds-select__value">{selected?.label ?? ''}</span>
        <span className="ds-select__caret" aria-hidden="true">▾</span>
      </button>
      <div
        ref={dropRef}
        id={listId}
        className={`ds-select__panel dropdown-panel${alignEnd ? ' ds-select__panel--align-end' : ''}`}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-opt-${activeIndex}` : undefined}
        style={style}
        hidden
      >
        {options.map((opt, index) => (
          <button
            key={String(opt.value)}
            id={`${listId}-opt-${index}`}
            type="button"
            role="option"
            aria-selected={opt.value === value}
            className={`ds-select__option${index === activeIndex ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => commit(index)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
