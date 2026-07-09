type StatusScreenTone = 'error' | 'info' | 'neutral'

interface StatusScreenAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export interface StatusScreenProps {
  tone?: StatusScreenTone
  title: string
  message?: string
  detail?: string
  detailLabel?: string
  actions?: StatusScreenAction[]
  busy?: boolean
}

export function StatusScreen({
  tone = 'neutral',
  title,
  message,
  detail,
  detailLabel,
  actions,
  busy = false,
}: StatusScreenProps) {
  return (
    <div
      className={`status-screen status-screen--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="status-screen__card">
        <div className="status-screen__header">
          {busy ? (
            <span className="status-screen__spinner" aria-hidden="true" />
          ) : (
            <span className="status-screen__dot" aria-hidden="true" />
          )}
          <h1 className="status-screen__title">{title}</h1>
        </div>

        {message ? <p className="status-screen__message">{message}</p> : null}

        {detail ? (
          <div className="status-screen__detail">
            {detailLabel ? (
              <p className="status-screen__detail-label">{detailLabel}</p>
            ) : null}
            <pre className="status-screen__pre">{detail}</pre>
          </div>
        ) : null}

        {actions && actions.length > 0 ? (
          <div className="status-screen__actions">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={`status-screen__btn${
                  action.variant === 'primary' ? ' status-screen__btn--primary' : ''
                }`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
