/* ToastProvider — infraestructura de toasts in-app (èxit/error).
   Manté la llista de toasts actius i els renderitza via portal a document.body.
   Cada toast desapareix sol passat un temps, o manualment amb el botó de tancar. */

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppIcon } from '../AppIcon'
import { ToastContext, type ToastApi, type ToastTone } from './toast-context'

const AUTO_DISMISS_MS = 4000

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer != null) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, tone }])
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const timersMap = timers.current
    return () => {
      timersMap.forEach((timer) => clearTimeout(timer))
      timersMap.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.tone}`}>
              <span className="toast__message">{toast.message}</span>
              <button
                type="button"
                className="toast__close"
                aria-label="Tanca"
                title="Tanca"
                onClick={() => dismiss(toast.id)}
              >
                <AppIcon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
