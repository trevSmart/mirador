import type { ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { useSmoothScroll } from '../hooks/useSmoothScroll'
import { PanelIcon } from '../panels/PanelIcon'
import type { PanelType } from '../panels/registry'

interface PanelShellProps {
  title?: string
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
  hideHeader?: boolean
  /** When false, Lenis is not attached to the shell (use on panels that scroll internally). */
  smoothScroll?: boolean
}

export function PanelShell({
  title,
  icon,
  children,
  actions,
  className,
  hideHeader = false,
  smoothScroll = true,
}: PanelShellProps) {
  const scrollRef = useSmoothScroll<HTMLDivElement>()
  const showHeader = !hideHeader && (title || icon || actions)

  return (
    <div
      className={['panel-shell', className].filter(Boolean).join(' ')}
      ref={smoothScroll ? scrollRef : undefined}
    >
      {showHeader ? (
        <div className="panel-shell__header">
          <div className="panel-shell__heading">
            {icon}
            <h2 className="panel-shell__title">{title ?? 'Panell'}</h2>
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  )
}

interface PanelStateProps {
  panelType?: PanelType
  title?: string
  isLoading: boolean
  error: string | null
  onRetry?: () => void | Promise<void>
  emptyMessage?: string
  isEmpty?: boolean
  children: ReactNode
  actions?: ReactNode
  hideHeader?: boolean
  shellClassName?: string
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
  hideHeader = false,
  shellClassName,
}: PanelStateProps) {
  const { isAuthenticated, isMockMode, isSalesforceEnabled } = useAuth()
  const icon = panelType ? <PanelIcon type={panelType} sldsSize="medium" /> : undefined

  return (
    <PanelShell
      title={hideHeader ? undefined : title}
      icon={hideHeader ? undefined : icon}
      actions={actions}
      className={shellClassName}
      hideHeader={hideHeader}
    >
      {!isMockMode && !isSalesforceEnabled ? (
        <PanelStatus icon={<StatusGlyph kind="config" />}>
          Configura SF_CLIENT_ID per connectar a Salesforce.
        </PanelStatus>
      ) : !isMockMode && !isAuthenticated ? (
        <PanelStatus icon={<Spinner />}>Redirigint a Salesforce…</PanelStatus>
      ) : isLoading ? (
        <PanelStatus icon={<Spinner />}>
          {isMockMode ? 'Carregant dades simulades…' : 'Carregant dades de Salesforce…'}
        </PanelStatus>
      ) : error ? (
        <PanelStatus tone="error" icon={<StatusGlyph kind="error" />}>
          {error}
          {onRetry ? (
            <button
              type="button"
              className="panel-status__button"
              onClick={() => void onRetry()}
            >
              Torna a intentar
            </button>
          ) : null}
        </PanelStatus>
      ) : isEmpty ? (
        <PanelStatus icon={<StatusGlyph kind="empty" />}>{emptyMessage}</PanelStatus>
      ) : (
        children
      )}
    </PanelShell>
  )
}

interface PanelStatusProps {
  icon: ReactNode
  tone?: 'muted' | 'error'
  children: ReactNode
}

/** Centred, friendly placeholder for loading / error / empty / config states. */
function PanelStatus({ icon, tone = 'muted', children }: PanelStatusProps) {
  return (
    <div className={`panel-status panel-status--${tone}`} role="status">
      <span className="panel-status__icon" aria-hidden>
        {icon}
      </span>
      <div className="panel-status__body">{children}</div>
    </div>
  )
}

function Spinner() {
  return <span className="panel-status__spinner" />
}

function StatusGlyph({ kind }: { kind: 'error' | 'empty' | 'config' }) {
  const paths: Record<typeof kind, ReactNode> = {
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </>
    ),
    empty: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <line x1="4" y1="10" x2="20" y2="10" />
      </>
    ),
    config: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind]}
    </svg>
  )
}
