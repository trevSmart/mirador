/* Settings modal — global open/close state.
   The user menu (or anything else) calls open(); a single <SettingsModal>
   mounted at the app root renders when isOpen. Mirrors the DetailDrawer pattern.
   The context + useSettingsModal hook live in ./settings-modal-context. */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import {
  SettingsModalContext,
  type SettingsModalContextValue,
  type SettingsSectionId,
} from './settings-modal-context'

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialSection, setInitialSection] = useState<SettingsSectionId>('aparenca')

  const open = useCallback((section: SettingsSectionId = 'aparenca') => {
    devLog.action('settings:open', section)
    setInitialSection(section)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    devLog.action('settings:close')
    setIsOpen(false)
  }, [])

  const value = useMemo<SettingsModalContextValue>(
    () => ({ isOpen, initialSection, open, close }),
    [isOpen, initialSection, open, close],
  )

  return <SettingsModalContext.Provider value={value}>{children}</SettingsModalContext.Provider>
}
