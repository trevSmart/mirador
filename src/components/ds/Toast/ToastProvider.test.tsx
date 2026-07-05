import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toast-context'

function ToastTrigger() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('fet')}>dispara-exit</button>
      <button onClick={() => toast.error('ups')}>dispara-error</button>
    </div>
  )
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra el missatge quan es crida success()', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('dispara-exit').click()
    })

    expect(screen.getByText('fet')).toBeInTheDocument()
  })

  it('mostra el missatge amb el to d\'error quan es crida error()', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('dispara-error').click()
    })

    const toastEl = screen.getByText('ups').closest('.toast')
    expect(toastEl).not.toBeNull()
    expect(toastEl).toHaveClass('toast--error')
  })

  it('treu el toast automàticament passat el temps (auto-dismiss)', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('dispara-exit').click()
    })
    expect(screen.getByText('fet')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText('fet')).toBeNull()
  })

  it('el botó de tancar treu el toast manualment', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('dispara-exit').click()
    })
    expect(screen.getByText('fet')).toBeInTheDocument()

    act(() => {
      screen.getByRole('button', { name: /tanca/i }).click()
    })

    expect(screen.queryByText('fet')).toBeNull()
  })

  it('useToast() fora del provider llança un error', () => {
    function TrencaSenseProvider() {
      useToast()
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TrencaSenseProvider />)).toThrow(
      'useToast must be used within ToastProvider',
    )
    spy.mockRestore()
  })
})
