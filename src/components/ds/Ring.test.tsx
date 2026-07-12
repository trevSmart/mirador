import { describe, expect, it } from 'vitest'
import { Component, type ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { Ring } from './Ring'

/* Boundary mínim per detectar errors de la fase de commit de React (una foto
   trencada no ha de fer caure el component quan `photo` canvia després). */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <div data-testid="boundary-fallback" /> : this.props.children
  }
}

function getArc(container: HTMLElement) {
  /* El segon <circle> és l'arc de capacitat (el primer és la pista de fons). */
  return container.querySelectorAll('circle')[1]
}

describe('Ring', () => {
  it("amaga la foto quan falla la càrrega i deixa veure les inicials", () => {
    const { container, getByText } = render(<Ring photo="https://example.test/p.png" initials="AB" />)

    fireEvent.error(container.querySelector('img')!)

    expect(container.querySelector('img')).toBeNull()
    expect(getByText('AB')).toBeInTheDocument()
  })

  it('sobreviu que `photo` passi a null després d’un error de càrrega', () => {
    const { container, rerender, queryByTestId } = render(
      <Boundary>
        <Ring photo="https://example.test/p.png" initials="AB" />
      </Boundary>,
    )

    fireEvent.error(container.querySelector('img') ?? container.querySelector('.ring__face')!)

    expect(() => {
      rerender(
        <Boundary>
          <Ring photo={null} initials="AB" />
        </Boundary>,
      )
    }).not.toThrow()
    expect(queryByTestId('boundary-fallback')).toBeNull()
  })

  it('torna a mostrar la imatge quan arriba una nova URL després d’un error', () => {
    const { container, rerender } = render(<Ring photo="https://example.test/p.png" initials="AB" />)

    fireEvent.error(container.querySelector('img')!)
    rerender(<Ring photo="https://example.test/p2.png" initials="AB" />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://example.test/p2.png')
  })

  it("clampa l'arc quan used > max (mai un dashoffset negatiu)", () => {
    const { container } = render(<Ring used={8} max={5} />)

    expect(getArc(container).getAttribute('stroke-dashoffset')).toBe('0')
  })
})
