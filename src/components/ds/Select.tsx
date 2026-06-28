import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'

export type SelectOption<T extends string | number> = { value: T; label: string }

/**
 * Find the bounding rect of the nearest ancestor that clips its overflow
 * (overflow other than `visible` on any axis). That edge — not the window's —
 * is the real boundary the dropdown must stay within, since a select can live
 * inside a scrolling column with content (a sidebar) to its right. Returns the
 * viewport-relative rect, or null if nothing clips before <body>.
 */
function findClipBounds(el: HTMLElement): DOMRect | null {
  let node: HTMLElement | null = el.parentElement
  while (node && node !== document.body) {
    const { overflow, overflowX, overflowY } = getComputedStyle(node)
    if (
      [overflow, overflowX, overflowY].some(
        (v) => v === 'auto' || v === 'scroll' || v === 'hidden' || v === 'clip',
      )
    ) {
      return node.getBoundingClientRect()
    }
    node = node.parentElement
  }
  return null
}

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

  // Animate open/close with the shared helper. On open, decide whether the
  // panel must align to the right edge of the trigger because there isn't
  // enough room to expand rightwards within the viewport.
  //
  // The align decision is applied IMPERATIVELY (classList) rather than via
  // setState on purpose: the panel's `hidden` attribute is hardcoded in the
  // JSX and only cleared imperatively by syncDropdownPanel. Any setState here
  // would trigger a re-render in which React re-reconciles that JSX and puts
  // `hidden` back, re-hiding the panel right after it opened — the bug that
  // made the dropdown need multiple clicks to appear.
  useEffect(() => {
    // Reveal the panel first: while it carries the `hidden` attribute it is
    // `display: none`, so `scrollWidth` reads 0 and the overflow check below
    // can never measure the real panel width. syncDropdownPanel clears
    // `hidden` synchronously on open, so the panel is laid out by the time we
    // measure it on the next lines.
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
    if (open) {
      const root = rootRef.current
      const panel = dropRef.current
      if (root && panel) {
        const rootRect = root.getBoundingClientRect()
        const triggerLeft = rootRect.left
        // Options are `white-space: nowrap`, so scrollWidth is the panel's
        // natural single-line width. Clamp to the trigger (min-width: 100%).
        const panelWidth = Math.max(panel.scrollWidth, root.offsetWidth)
        const margin = 8
        // The right boundary is the clipping container's edge, not the
        // window's. The select often sits inside a column with a sidebar to
        // its right, so a narrow panel can fit within the window yet still
        // overflow its visible container. Walk up to the nearest scroll/clip
        // ancestor and use its right edge; fall back to the viewport.
        const clip = findClipBounds(root)
        const rightBound = clip ? clip.right : window.innerWidth
        const leftBound = clip ? clip.left : 0
        const overflowsRight = triggerLeft + panelWidth > rightBound - margin
        // Only flip if aligning to the right actually keeps it in-bounds.
        const fitsWhenAlignedEnd =
          rootRect.right - panelWidth >= leftBound + margin
        panel.classList.toggle(
          'ds-select__panel--align-end',
          overflowsRight && fitsWhenAlignedEnd,
        )
      }
    }
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
        className="ds-select__panel dropdown-panel"
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
