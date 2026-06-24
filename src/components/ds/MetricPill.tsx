import { FadeValue } from './FadeValue'

interface MetricPillProps {
  label: string
  value: string | number
}

/** MetricPill — label + animated value chip used on entity rows. */
export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <div className="metric-pill">
      <span className="metric-pill__label">{label}</span>
      <FadeValue className="metric-pill__value" value={value} />
    </div>
  )
}
