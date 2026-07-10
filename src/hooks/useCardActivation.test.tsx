import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useCardActivation } from './useCardActivation'

function Harness({ onActivate }: { onActivate: (newTab: boolean) => void }) {
  return (
    <article {...useCardActivation(onActivate)}>
      <span>contingut seleccionable</span>
    </article>
  )
}

/** Simula l'estat de la selecció del document per al proper clic. */
function mockSelection(collapsed: boolean) {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: collapsed,
  } as Selection)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCardActivation', () => {
  it('activa amb un clic net (sense selecció)', () => {
    const onActivate = vi.fn()
    mockSelection(true)
    render(<Harness onActivate={onActivate} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it("NO activa si el clic ve del final d'una selecció de text", () => {
    const onActivate = vi.fn()
    mockSelection(false)
    render(<Harness onActivate={onActivate} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onActivate).not.toHaveBeenCalled()
  })

  it('demana pestanya nova (newTab) amb Cmd o Ctrl + clic', () => {
    const onActivate = vi.fn()
    mockSelection(true)
    render(<Harness onActivate={onActivate} />)

    const el = screen.getByRole('button')
    fireEvent.click(el)
    fireEvent.click(el, { metaKey: true })
    fireEvent.click(el, { ctrlKey: true })

    expect(onActivate.mock.calls).toEqual([[false], [true], [true]])
  })

  it('activa amb Enter i amb Espai', () => {
    const onActivate = vi.fn()
    mockSelection(false) // hi ha selecció, però el teclat no n'hauria de dependre
    render(<Harness onActivate={onActivate} />)

    const el = screen.getByRole('button')
    fireEvent.keyDown(el, { key: 'Enter' })
    fireEvent.keyDown(el, { key: ' ' })

    expect(onActivate).toHaveBeenCalledTimes(2)
  })
})
