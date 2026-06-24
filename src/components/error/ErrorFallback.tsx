interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--global" role="alert">
      <div className="error-fallback__card">
        <h1 className="error-fallback__title">Alguna cosa ha fallat</h1>
        <p className="error-fallback__message">
          S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista.
        </p>
        <details className="error-fallback__details">
          <summary>Detalls de l'error</summary>
          <pre className="error-fallback__pre">{error.message}</pre>
        </details>
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
