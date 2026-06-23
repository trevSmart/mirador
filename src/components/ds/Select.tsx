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

  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedIndex = options.findIndex((o) => o.value === value)

  // Animate open/close with the shared helper.
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  // When opening, highlight the current value.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

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
        else setOpen(true)
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
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
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="ds-select__value">{selected?.label ?? ''}</span>
        <span className="ds-select__caret" aria-hidden="true">▾</span>
      </button>
      <div
        ref={dropRef}
        id={listId}
        className="ds-select__panel dropdown-panel"
        role="listbox"
        aria-label={ariaLabel}
        style={style}
        hidden
      >
        {options.map((opt, index) => (
          <button
            key={String(opt.value)}
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
