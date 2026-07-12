import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VBarChart } from './VBarChart'

function renderChart(values: number[]) {
  const { container } = render(
    <VBarChart data={values.map((value, i) => ({ label: `c${i}`, value }))} />,
  )
  /* De dalt a baix: la primera etiqueta és el màxim de l'eix. */
  const ticks = [...container.querySelectorAll('.wb-vbar__tick')].map((el) =>
    Number(el.textContent),
  )
  return { container, ticks }
}

describe('VBarChart', () => {
  it('cada etiqueta de tick coincideix exactament amb la posició de la seva gridline', () => {
    /* Les gridlines són fixes al CSS (0/25/50/75/100%), de manera que les
       etiquetes han de ser exactament equiespaiades. Un màxim de 9 forçava un
       axisMax (10) no divisible pel nombre de ticks: l'etiqueta "8" queia
       sobre la gridline del 75% quan 8/10 és el 80%. */
    const { ticks } = renderChart([9, 2])
    const max = ticks[0]
    const segments = ticks.length - 1

    ticks.forEach((t, i) => {
      expect(t).toBeCloseTo(max * ((segments - i) / segments), 6)
      expect(Number.isInteger(t)).toBe(true)
    })
  })

  it('una barra amb el valor d’una etiqueta arriba just a la seva gridline', () => {
    const { container, ticks } = renderChart([9, 3])
    const segments = ticks.length - 1
    const bar = container.querySelectorAll<HTMLElement>('.wb-vbar__bar')[1]

    /* El valor 3 ha de ser una etiqueta, i l'alçada de la barra (3/max) ha de
       coincidir amb la fracció de la gridline d'aquesta etiqueta. */
    expect(ticks).toContain(3)
    const gridFraction = (segments - ticks.indexOf(3)) / segments
    expect(parseFloat(bar.style.height)).toBeCloseTo(gridFraction * 100, 6)
  })
})
