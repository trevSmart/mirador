import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const useAuthMock = vi.fn(() => ({
  authError: null,
  isAuthenticated: true,
  isSalesforceEnabled: true,
  login: vi.fn(),
}))
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => useAuthMock(),
}))

import { AppGate } from './AppGate'

function authState(overrides: Record<string, unknown> = {}) {
  return {
    authError: null,
    isAuthenticated: true,
    isSalesforceEnabled: true,
    login: vi.fn(),
    ...overrides,
  }
}

describe('AppGate', () => {
  beforeEach(() => useAuthMock.mockReset())

  it('renders children when authenticated and no error', () => {
    useAuthMock.mockReturnValue(authState())
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.getByText('APP CONTENT')).toBeInTheDocument()
  })

  it('shows an error StatusScreen with the raw authError as detail', () => {
    useAuthMock.mockReturnValue(
      authState({ authError: 'External client app is not installed in this org', isAuthenticated: false }),
    )
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.queryByText('APP CONTENT')).toBeNull()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText('External client app is not installed in this org'),
    ).toBeInTheDocument()
  })

  it('Reintenta button calls login', () => {
    const login = vi.fn()
    useAuthMock.mockReturnValue(
      authState({ authError: 'boom', isAuthenticated: false, login }),
    )
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    screen.getByText('Reintenta').click()
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('shows a busy redirect screen when login is in progress', () => {
    useAuthMock.mockReturnValue(
      authState({ authError: null, isAuthenticated: false, isSalesforceEnabled: true }),
    )
    const { container } = render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.queryByText('APP CONTENT')).toBeNull()
    expect(container.querySelector('.status-screen__spinner')).not.toBeNull()
  })
})
