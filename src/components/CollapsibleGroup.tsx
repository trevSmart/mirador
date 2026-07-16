import type { ReactNode } from 'react'
import { AppIcon } from './ds/AppIcon'
import { useCollapsible } from '../hooks/useCollapsible'

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
