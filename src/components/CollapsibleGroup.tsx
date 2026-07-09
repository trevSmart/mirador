import { useState, type ReactNode } from 'react'
import { AppIcon } from './ds/AppIcon'

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
 * A panel section whose body collapses/expands under a clickable header, using
 * the apex-log-viewer accordion pattern: an outer grid animating
 * grid-template-rows 0fr↔1fr plus an inner layer that fades and grows padding.
 * The inner clips overflow while animating and only returns to `visible` once
 * fully open, so card shadows and hover-lift aren't cut mid-transition.
 */
export function CollapsibleGroup({
  className,
  icon,
  title,
  meta,
  defaultCollapsed = false,
  children,
}: CollapsibleGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [animating, setAnimating] = useState(false)
  const overflowVisible = !collapsed && !animating

  return (
    <section className={`panel-section collapsible-group${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="panel-section__header collapsible-group__toggle"
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed((value) => !value)
          setAnimating(true)
        }}
      >
        <div className="panel-section__heading">
          <AppIcon
            name="chevronright"
            size={12}
            className={`collapsible-group__chevron${collapsed ? '' : ' collapsible-group__chevron--open'}`}
          />
          {icon}
          {title}
        </div>
        {meta}
      </button>

      <div
        className={`collapsible-group__expand${collapsed ? '' : ' is-open'}`}
        onTransitionEnd={(event) => {
          if (event.propertyName === 'grid-template-rows') setAnimating(false)
        }}
      >
        <div className={`collapsible-group__expand-inner${overflowVisible ? ' is-visible' : ''}`}>
          {children}
        </div>
      </div>
    </section>
  )
}
