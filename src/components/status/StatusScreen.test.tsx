import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusScreen } from './StatusScreen'

describe('StatusScreen', () => {
  it('renders title, message and detail', () => {
    render(
      <StatusScreen
        title="No s'ha pogut connectar"
        message="Hi ha hagut un problema."
        detail="raw error text"
        detailLabel="Detalls"
      />,
    )
    expect(screen.getByText("No s'ha pogut connectar")).toBeInTheDocument()
    expect(screen.getByText('Hi ha hagut un problema.')).toBeInTheDocument()
    expect(screen.getByText('raw error text')).toBeInTheDocument()
    expect(screen.getByText('Detalls')).toBeInTheDocument()
  })

  it('renders one button per action and fires onClick', () => {
    const onRetry = vi.fn()
    render(
      <StatusScreen
        title="X"
        actions={[
          { label: 'Reintenta', onClick: onRetry, variant: 'primary' },
          { label: 'Recarrega', onClick: () => {} },
        ]}
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    screen.getByText('Reintenta').click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders no action row when actions is empty or absent', () => {
    render(<StatusScreen title="X" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a spinner when busy and no dot', () => {
    const { container } = render(<StatusScreen title="Carregant" busy />)
    expect(container.querySelector('.status-screen__spinner')).not.toBeNull()
    expect(container.querySelector('.status-screen__dot')).toBeNull()
  })

  it('uses role=alert for error tone and role=status otherwise', () => {
    const { rerender } = render(<StatusScreen title="X" tone="error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<StatusScreen title="X" tone="info" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
