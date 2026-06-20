import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'

interface PanelShellProps {
  title?: string
  children: ReactNode
  actions?: ReactNode
}

export function PanelShell({ title, children, actions }: PanelShellProps) {
  return (
    <div className="panel-shell">
      <div className="panel-shell__header">
        <h2 className="panel-shell__title">{title ?? 'Panell'}</h2>
        {actions}
      </div>
      {children}
    </div>
  )
}

interface PanelStateProps {
  title?: string
  isLoading: boolean
  error: string | null
  onRetry?: () => void
  emptyMessage?: string
  isEmpty?: boolean
  children: ReactNode
  actions?: ReactNode
}

export function PanelState({
  title,
  isLoading,
  error,
  onRetry,
  emptyMessage = 'No hi ha dades per mostrar.',
  isEmpty = false,
  children,
  actions,
}: PanelStateProps) {
  const { isAuthenticated, isSalesforceEnabled, login } = useAuth()

  return (
    <PanelShell title={title} actions={actions}>
      {!isSalesforceEnabled ? (
        <p className="panel-state panel-state--muted">
          Configura SF_CLIENT_ID per connectar a Salesforce.
        </p>
      ) : !isAuthenticated ? (
        <div className="panel-state">
          <p className="panel-state--muted">Inicia sessió per veure les dades d&apos;Omni.</p>
          <button type="button" className="panel-state__button" onClick={() => void login()}>
            Login
          </button>
        </div>
      ) : isLoading ? (
        <p className="panel-state panel-state--muted">Carregant dades de Salesforce…</p>
      ) : error ? (
        <div className="panel-state">
          <p className="panel-state--error">{error}</p>
          {onRetry ? (
            <button type="button" className="panel-state__button" onClick={() => void onRetry()}>
              Torna a intentar
            </button>
          ) : null}
        </div>
      ) : isEmpty ? (
        <p className="panel-state panel-state--muted">{emptyMessage}</p>
      ) : (
        children
      )}
    </PanelShell>
  )
}
