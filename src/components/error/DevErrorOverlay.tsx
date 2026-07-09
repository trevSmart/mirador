import { useCallback, useEffect, useState } from 'react'
import type { ErrorPayload } from 'vite/types/hmrPayload.js'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { formatViteError, type FormattedViteError } from './format-vite-error'

export function DevErrorOverlay() {
  const [error, setError] = useState<FormattedViteError | null>(null)
  const trapRef = useFocusTrap<HTMLDivElement>(error !== null)

  const dismiss = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return

    const onError = (payload: ErrorPayload) => {
      setError(formatViteError(payload.err))
    }

    const clear = () => {
      setError(null)
    }

    hot.on('vite:error', onError)
    hot.on('vite:beforeUpdate', clear)
    hot.on('vite:beforeFullReload', clear)

    return () => {
      hot.off('vite:error', onError)
      hot.off('vite:beforeUpdate', clear)
      hot.off('vite:beforeFullReload', clear)
    }
  }, [])

  useEffect(() => {
    if (!error) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dismiss, error])

  if (!error) return null

  return (
    <div
      ref={trapRef}
      className="dev-error-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dev-error-overlay-title"
      onClick={dismiss}
    >
      <div className="dev-error-overlay__card" onClick={(event) => event.stopPropagation()}>
        <div className="error-fallback__header">
          <span className="error-fallback__dot" aria-hidden="true" />
          <h2 className="error-fallback__title" id="dev-error-overlay-title">
            Error de compilació
          </h2>
        </div>
        <p className="error-fallback__message dev-error-overlay__headline">{error.headline}</p>
        {error.body ? (
          <div className="error-fallback__detail">
            <p className="error-fallback__detail-label">Detalls</p>
            <pre className="error-fallback__pre dev-error-overlay__pre">{error.body}</pre>
          </div>
        ) : null}
        <p className="dev-error-overlay__hint">
          Prem <kbd>Esc</kbd> o fes clic fora per tancar. Es netejarà sol quan el codi compili de nou.
        </p>
      </div>
    </div>
  )
}
