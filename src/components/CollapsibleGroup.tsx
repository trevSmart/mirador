import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppIcon } from './ds/AppIcon'

/** Fallback used if `transitionend` never fires (see below); a touch above the
    0.35s CSS transition so it only ever acts as a safety net. */
const SETTLE_FALLBACK_MS = 420

/**
 * Collapse/expand state shared by every collapsible surface (panel groups,
 * drawer sections…). `toggle` flips collapsed and marks the transition as
 * running in the same synchronous update, so there's never a frame where an
 * opening body is briefly treated as settled (which would flash overflow).
 *
 * `animating` is normally cleared by the body's `transitionend`, but two toggles
 * inside one frame cancel out to no net `open` change — so no transition runs
 * and `transitionend` never fires. A timeout guarantees `animating` always
 * clears, otherwise it would stick true and leave the body's overflow clipped.
 */
export function useCollapsible(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const toggle = () => {
    setCollapsed((value) => !value)
    setAnimating(true)
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setAnimating(false)
    }, SETTLE_FALLBACK_MS)
  }

  const settle = () => {
    clearTimer()
    setAnimating(false)
  }

  useEffect(() => clearTimer, [])

  return { collapsed, open: !collapsed, animating, toggle, settle }
}

interface CollapsibleBodyProps {
  open: boolean
  animating: boolean
  onSettled: () => void
  children: ReactNode
}

/**
 * The animated body of a collapsible surface — the apex-log-viewer accordion
 * pattern: an outer grid animating grid-template-rows 0fr↔1fr, plus an inner
 * layer that fades opacity and grows padding. The inner clips overflow while
 * animating and only returns to `visible` once fully open, so card shadows and
 * hover-lift aren't cut mid-transition.
 */
export function CollapsibleBody({ open, animating, onSettled, children }: CollapsibleBodyProps) {
  const overflowVisible = open && !animating
  return (
    <div
      className={`collapsible-group__expand${open ? ' is-open' : ''}`}
      onTransitionEnd={(event) => {
        if (event.propertyName === 'grid-template-rows') onSettled()
      }}
    >
      <div className={`collapsible-group__expand-inner${overflowVisible ? ' is-visible' : ''}`}>
        {children}
      </div>
    </div>
  )
}

interface CollapsibleGroupProps {
  /** Extra class on the <section> (e.g. 'work-group', 'skill-group') for spacing/meta styling. */
  className?: string
  /** Leading icon/avatar node shown before the title. */
  icon: ReactNode
  /** Title node — typically an <h3 className="panel-section__title">. */
  title: ReactNode
  /** Optional right-aligned summary (count, oldest age…). */
  meta?: ReactNode
  /** Start collapsed instead of expanded. */
  defaultCollapsed?: boolean
  children: ReactNode
}

/**
 * A panel section whose body collapses/expands under a clickable header. Uses
 * {@link useCollapsible} and {@link CollapsibleBody} for the shared animation.
 */
export function CollapsibleGroup({
  className,
  icon,
  title,
  meta,
  defaultCollapsed = false,
  children,
}: CollapsibleGroupProps) {
  const { open, animating, toggle, settle } = useCollapsible(defaultCollapsed)

  return (
    <section className={`panel-section collapsible-group${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="panel-section__header collapsible-group__toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        <div className="panel-section__heading">
          <AppIcon
            name="chevronright"
            size={12}
            className={`collapsible-group__chevron${open ? ' collapsible-group__chevron--open' : ''}`}
          />
          {icon}
          {title}
        </div>
        {meta}
      </button>

      <CollapsibleBody open={open} animating={animating} onSettled={settle}>
        {children}
      </CollapsibleBody>
    </section>
  )
}
