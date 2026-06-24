/* Donut chart — SLDS style. Used by "Agent Primary Capacity" to show
   "% Used Capacity". A single SVG ring with the used arc in blue (the
   standard wallboard uses a thick purple-ish ring; we follow the SLDS blue
   plus a muted track), with a legend beside it. */

interface DonutChartProps {
  /** 0..1 used-capacity ratio. */
  ratio: number
}

const SIZE = 150
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export function DonutChart({ ratio }: DonutChartProps) {
  const pct = Math.round(ratio * 100)
  const used = CIRC * ratio

  return (
    <div className="wb-donut">
      <svg
        className="wb-donut__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${pct}% used capacity`}
      >
        <circle
          className="wb-donut__track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
        />
        <circle
          className="wb-donut__arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={`${used} ${CIRC - used}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <ul className="wb-donut__legend">
        <li className="wb-donut__legend-item">
          <span className="wb-donut__swatch wb-donut__swatch--used" />
          {pct}% Used Capacity
        </li>
        <li className="wb-donut__legend-item">
          <span className="wb-donut__swatch wb-donut__swatch--free" />
          {100 - pct}% Available
        </li>
      </ul>
    </div>
  )
}
