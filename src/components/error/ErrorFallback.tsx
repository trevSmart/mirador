interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--global" role="alert">
      <div className="error-fallback__card">
        <div className="error-fallback__header">
          <span className="error-fallback__dot" aria-hidden="true" />
          <h1 className="error-fallback__title">Alguna cosa ha fallat</h1>
        </div>
        <p className="error-fallback__message">
          S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista.
        </p>
        <div className="error-fallback__detail">
          <p className="error-fallback__detail-label">Detalls de l'error</p>
          <pre className="error-fallback__pre">{error.message}</pre>
        </div>
        <div className="error-fallback__actions">
          <button type="button" className="error-fallback__btn error-fallback__btn--primary" onClick={reset}>
            Torna-ho a provar
          </button>
          <button type="button" className="error-fallback__btn" onClick={() => window.location.reload()}>
            Recarrega la pàgina
          </button>
        </div>
      </div>
    </div>
  )
}
