import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSmoothScroll } from '../hooks/useSmoothScroll'
import { PanelIcon } from '../panels/PanelIcon'
import type { PanelType } from '../panels/registry'

interface PanelShellProps {
  title?: string
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
}

export function PanelShell({ title, icon, children, actions }: PanelShellProps) {
  const scrollRef = useSmoothScroll<HTMLDivElement>()

  return (
    <div className="panel-shell" ref={scrollRef}>
      <div className="panel-shell__header">
        <div className="panel-shell__heading">
          {icon}
          <h2 className="panel-shell__title">{title ?? 'Panell'}</h2>
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

interface PanelStateProps {
  panelType?: PanelType
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
  panelType,
  title,
  isLoading,
  error,
  onRetry,
  emptyMessage = 'No hi ha dades per mostrar.',
  isEmpty = false,
  children,
  actions,
}: PanelStateProps) {
  const { isAuthenticated, isMockMode, isSalesforceEnabled } = useAuth()
  const icon = panelType ? <PanelIcon type={panelType} size={28} /> : undefined

  return (
    <PanelShell title={title} icon={icon} actions={actions}>
      {!isMockMode && !isSalesforceEnabled ? (
        <p className="panel-state panel-state--muted">
          Configura SF_CLIENT_ID per connectar a Salesforce.
        </p>
      ) : !isMockMode && !isAuthenticated ? (
        <p className="panel-state panel-state--muted">Redirigint a Salesforce…</p>
      ) : isLoading ? (
        <p className="panel-state panel-state--muted">
          {isMockMode ? 'Carregant dades simulades…' : 'Carregant dades de Salesforce…'}
        </p>
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
