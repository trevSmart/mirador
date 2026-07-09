import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

/* Un dialog mínim que usa useFocusTrap. El botó "outside" viu fora del
   contenidor atrapat per comprovar que el focus no en pot escapar tabulant. */
function Harness({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const ref = useFocusTrap<HTMLDivElement>(open)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button">outside</button>
      {open && (
        <div ref={ref} role="dialog">
          <button type="button">first</button>
          <button type="button">middle</button>
          <button type="button" onClick={() => setOpen(false)}>
            last
          </button>
        </div>
      )}
    </>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the container when it activates', () => {
    render(<Harness />)
    screen.getByText('open').focus()
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('wraps focus from the last element back to the first on Tab', () => {
    render(<Harness startOpen />)
    const last = screen.getByText('last')
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('wraps focus from the first element to the last on Shift+Tab', () => {
    render(<Harness startOpen />)
    const first = screen.getByText('first')
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('last')).toHaveFocus()
  })

  it('restores focus to the previously focused element when it deactivates', () => {
    render(<Harness />)
    const opener = screen.getByText('open')
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByText('first')).toHaveFocus()
    // El botó "last" tanca el dialog; el focus ha de tornar a qui l'havia obert.
    fireEvent.click(screen.getByText('last'))
    expect(opener).toHaveFocus()
  })
})
