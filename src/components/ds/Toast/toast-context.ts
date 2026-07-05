/* Toasts — context + hook (sense components, per mantenir Fast Refresh content).
   El <ToastProvider> viu a ToastProvider.tsx i proveeix el valor d'aquest context. */

import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastApi {
  success(message: string): void
  error(message: string): void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
