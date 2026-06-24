/* Settings modal — context + hook (no components, so Fast Refresh stays happy).
   The <SettingsModalProvider> lives in SettingsModalProvider.tsx and supplies
   this context's value. */

import { createContext, useContext } from 'react'

export type SettingsSectionId =
  | 'connexio'
  | 'dades'
  | 'aparenca'
  | 'notificacions'
  | 'developer'
  | 'sobre'

export interface SettingsModalContextValue {
  isOpen: boolean
  /** Section to land on when opening (defaults to 'aparenca', the first nav item). */
  initialSection: SettingsSectionId
  open: (section?: SettingsSectionId) => void
  close: () => void
}

export const SettingsModalContext = createContext<SettingsModalContextValue | null>(null)

export function useSettingsModal(): SettingsModalContextValue {
  const ctx = useContext(SettingsModalContext)
  if (!ctx) {
    throw new Error('useSettingsModal must be used within SettingsModalProvider')
  }
  return ctx
}
