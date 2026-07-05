import type { ReactNode } from 'react'
import { AppIcon } from '../ds/AppIcon'
import { SfIcon, type SfSprite } from '../ds/SfIcon'

/* SLDS-faithful chassis for a single wallboard tile: a colored icon tile,
   a title, a period badge ("Current" / "Last Hour"), an overflow menu, and
   the filter sub-line — matching the standard Omni-Supervisor wallboard. */

type WallboardPeriod = 'Current' | 'Last Hour'

interface WallboardCardProps {
  title: string
  period: WallboardPeriod
  /** Object icon left of the title; the tile takes its official SLDS color. */
  icon: { sprite: SfSprite; symbol: string }
  /** Sub-line under the title. Defaults to "No filter applied". */
  filterText?: string
  /** Optional trailing control in the header (e.g. a chart-type toggle). */
  headerAction?: ReactNode
  /** Marks the card as showing placeholder/mock data (no real source yet). */
  comingSoon?: boolean
  children: ReactNode
}

export function WallboardCard({
  title,
  period,
  icon,
  filterText = 'No filter applied',
  headerAction,
  comingSoon = false,
  children,
}: WallboardCardProps) {
  return (
    <article className="wb-card">
      <header className="wb-card__header">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={28} radius={5} className="wb-card__icon" />
        <div className="wb-card__titles">
          <div className="wb-card__title-row">
            <h3 className="wb-card__title">{title}</h3>
            <span className="wb-card__badge">{period}</span>
            {comingSoon ? (
              <span className="wb-card__badge wb-card__badge--soon">Pròximament</span>
            ) : null}
          </div>
          <p className="wb-card__filter">{filterText}</p>
        </div>
        <div className="wb-card__action">
          {headerAction}
          <button type="button" className="wb-card__menu" aria-label="Card options">
            <AppIcon name="threedots_vertical" size={14} style={{ color: '#747474' }} />
          </button>
        </div>
      </header>
      <div className="wb-card__body">{children}</div>
    </article>
  )
}
