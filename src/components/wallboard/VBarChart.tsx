/* Vertical bar chart — SLDS analytics style. Used by "Agent Primary Capacity
   Status". Renders a Y axis with gridlines, blue bars, the value above each
   bar, and category labels below. Falls back to an SLDS "no data" message
   when every value is zero. */

interface VBarDatum {
  label: string
  value: number
}

interface VBarChartProps {
  data: VBarDatum[]
}

/** Nice rounded axis max so gridlines land on whole numbers. */
function axisMax(values: number[]): number {
  const max = Math.max(0, ...values)
  if (max <= 5) return 5
  if (max <= 10) return 10
  if (max <= 20) return 20
  return Math.ceil(max / 10) * 10
}

export function VBarChart({ data }: VBarChartProps) {
  const values = data.map((d) => d.value)
  if (values.every((v) => v === 0)) {
    return <p className="wb-nodata">We can&rsquo;t draw this chart because there&rsquo;s no data.</p>
  }

  const max = axisMax(values)
  const ticks = 4
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * (ticks - i)))

  return (
    <div className="wb-vbar">
      <div className="wb-vbar__plot">
        <div className="wb-vbar__yaxis">
          {tickValues.map((t) => (
            <span key={t} className="wb-vbar__tick">{t}</span>
          ))}
        </div>
        <div className="wb-vbar__bars">
          {tickValues.map((t) => (
            <div key={t} className="wb-vbar__gridline" />
          ))}
          {data.map((d) => (
            <div key={d.label} className="wb-vbar__col">
              <span className="wb-vbar__value">{d.value}</span>
              <div
                className="wb-vbar__bar"
                style={{ height: `${(d.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="wb-vbar__labels">
        {data.map((d) => (
          <span key={d.label} className="wb-vbar__label">{d.label}</span>
        ))}
      </div>
    </div>
  )
}
