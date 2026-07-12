/* Horizontal bar chart — SLDS analytics style. Used by "Agent Presence
   Statuses" and "Agent Work Status". Renders a top axis with gridlines,
   left-aligned category labels, blue bars, and the value at the bar end. */

import { AXIS_SEGMENTS, axisTicks } from './axis-scale'

interface HBarDatum {
  label: string
  value: number
}

interface HBarChartProps {
  data: HBarDatum[]
}

export function HBarChart({ data }: HBarChartProps) {
  const values = data.map((d) => d.value)
  if (values.every((v) => v === 0)) {
    return <p className="wb-nodata">We can&rsquo;t draw this chart because there&rsquo;s no data.</p>
  }

  const ticks = AXIS_SEGMENTS
  const tickValues = axisTicks(values)
  const max = tickValues[tickValues.length - 1]

  return (
    <div className="wb-hbar">
      <div className="wb-hbar__xaxis">
        {tickValues.map((t) => (
          <span key={t} className="wb-hbar__tick">{t}</span>
        ))}
      </div>
      <div className="wb-hbar__rows">
        {tickValues.map((t, i) => (
          <div
            key={t}
            className="wb-hbar__gridline"
            style={{ left: `${(i / ticks) * 100}%` }}
          />
        ))}
        {data.map((d) => (
          <div key={d.label} className="wb-hbar__row">
            <span className="wb-hbar__label">{d.label}</span>
            <div className="wb-hbar__track">
              <div className="wb-hbar__bar" style={{ width: `${(d.value / max) * 100}%` }}>
                <span className="wb-hbar__value">{d.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
