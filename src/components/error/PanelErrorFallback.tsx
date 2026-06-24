interface PanelErrorFallbackProps {
  error: Error
  reset: () => void
}

export function PanelErrorFallback({ error, reset }: PanelErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--panel" role="alert">
      <p className="error-fallback__message">Aquest panell ha trobat un error.</p>
      <pre className="error-fallback__pre error-fallback__pre--compact">{error.message}</pre>
      <button type="button" className="error-fallback__btn error-fallback__btn--primary" onClick={reset}>
        Torna-ho a provar
      </button>
    </div>
  )
}
