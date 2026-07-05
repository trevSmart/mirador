/* Big numeric stat blocks — SLDS style. Used by "Wait Time", "Raised Flags"
   and "Work Performance". Each stat has a label with a small info icon and a
   large value; a null value renders the SLDS em-dash placeholder ("—"). */

import { AppIcon } from '../ds/AppIcon'

interface StatItem {
  label: string
  /** Pre-formatted display value, or null for the "—" placeholder. */
  value: string | null
}

interface BigStatProps {
  items: StatItem[]
  /** Layout: stacked (Wait Time), single huge number (Raised Flags),
      or a 2-column grid (Work Performance). */
  variant?: 'stack' | 'single' | 'grid'
}

export function BigStat({ items, variant = 'stack' }: BigStatProps) {
  return (
    <div className={`wb-stats wb-stats--${variant}`}>
      {items.map((item) => (
        <div key={item.label} className="wb-stat">
          <div className="wb-stat__label">
            <span>{item.label}</span>
            <AppIcon name="info" size={14} style={{ color: '#b0b0b0' }} />
          </div>
          <div className="wb-stat__value">{item.value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}
