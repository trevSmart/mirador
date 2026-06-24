interface PanelErrorFallbackProps {
  error: Error
  reset: () => void
}

export function PanelErrorFallback({ error, reset }: PanelErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--panel" role="alert">
      <div className="error-fallback__panel-card">
        <div className="error-fallback__header">
          <span className="error-fallback__dot" aria-hidden="true" />
          <h2 className="error-fallback__title">Aquest panell ha trobat un error</h2>
        </div>
        <div className="error-fallback__detail">
          <p className="error-fallback__detail-label">Detalls</p>
          <pre className="error-fallback__pre">{error.message}</pre>
        </div>
        <button type="button" className="error-fallback__btn error-fallback__btn--primary" onClick={reset}>
          Torna-ho a provar
        </button>
      </div>
    </div>
  )
}
