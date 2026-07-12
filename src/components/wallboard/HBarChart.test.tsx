import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HBarChart } from './HBarChart'

function renderChart(values: number[]) {
  const { container } = render(
    <HBarChart data={values.map((value, i) => ({ label: `c${i}`, value }))} />,
  )
  const ticks = [...container.querySelectorAll('.wb-hbar__tick')].map((el) =>
    Number(el.textContent),
  )
  const gridlines = [...container.querySelectorAll<HTMLElement>('.wb-hbar__gridline')].map((el) =>
    parseFloat(el.style.left),
  )
  return { container, ticks, gridlines }
}

describe('HBarChart', () => {
  it('cada etiqueta de tick coincideix exactament amb la posició de la seva gridline', () => {
    /* Un màxim de 9 forçava un axisMax (10) no divisible pel nombre de ticks:
       l'etiqueta "3" queia sobre la gridline del 25% quan 3/10 és el 30%. */
    const { ticks, gridlines } = renderChart([9, 2])
    const max = ticks[ticks.length - 1]

    expect(gridlines).toHaveLength(ticks.length)
    ticks.forEach((t, i) => {
      expect((t / max) * 100).toBeCloseTo(gridlines[i], 6)
    })
  })

  it('les etiquetes de tick són enters equiespaiats', () => {
    const { ticks } = renderChart([9, 2])
    const step = ticks[1] - ticks[0]

    ticks.forEach((t, i) => {
      expect(Number.isInteger(t)).toBe(true)
      expect(t).toBe(step * i)
    })
  })

  it('una barra amb el valor d’una etiqueta acaba just a la seva gridline', () => {
    const { container, ticks, gridlines } = renderChart([9, 3])
    const bar = container.querySelectorAll<HTMLElement>('.wb-hbar__bar')[1]

    expect(ticks).toContain(3)
    expect(parseFloat(bar.style.width)).toBeCloseTo(gridlines[ticks.indexOf(3)], 6)
  })
})
