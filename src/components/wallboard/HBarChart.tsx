/* Horizontal bar chart — SLDS analytics style. Used by "Agent Presence
   Statuses" and "Agent Work Status". Renders a top axis with gridlines,
   left-aligned category labels, blue bars, and the value at the bar end. */

interface HBarDatum {
  label: string
  value: number
}

interface HBarChartProps {
  data: HBarDatum[]
}

function axisMax(values: number[]): number {
  const max = Math.max(0, ...values)
  if (max <= 5) return 5
  if (max <= 10) return 10
  if (max <= 20) return 20
  if (max <= 100) return Math.ceil(max / 20) * 20
  return Math.ceil(max / 50) * 50
}

export function HBarChart({ data }: HBarChartProps) {
  const values = data.map((d) => d.value)
  if (values.every((v) => v === 0)) {
    return <p className="wb-nodata">We can&rsquo;t draw this chart because there&rsquo;s no data.</p>
  }

  const max = axisMax(values)
  const ticks = 4
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i))

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
