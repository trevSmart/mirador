/* GlobalShortcutsProvider — l'ÚNIC addEventListener('keydown') global per a
   dreceres d'app. Recorre SHORTCUTS, comprova condicions (modificadors, camp
   de text, modal obert) i executa l'acció. No renderitza res visible.

   Ha d'anar prou avall a l'arbre per accedir als hooks d'acció (useSettingsModal)
   i al registre de modals (useModalRegistry). */

import { useEffect, useMemo, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { useDockviewHost } from '../dockview/dockview-host-context'
import { useModalRegistry } from '../modals/modal-registry-context'
import { addPanelByType } from '../panels/panel-actions'
import { useSettingsModal } from '../settings/settings-modal-context'
import { SHORTCUTS } from './shortcuts'
import type { ShortcutContext } from './shortcut-types'

/** Cert si el focus actual és en un camp on l'usuari escriu text. */
function isEditingTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

export function GlobalShortcutsProvider({ children }: { children: ReactNode }) {
  const { isAnyModalOpen } = useModalRegistry()
  const { open: openSettings } = useSettingsModal()
  const { getApi } = useDockviewHost()

  const shortcutCtx = useMemo<ShortcutContext>(
    () => ({
      openSettings: () => openSettings(),
      openPanel: (type) => {
        const api = getApi()
        if (api) addPanelByType(api, type)
      },
    }),
    [openSettings, getApi],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      /* Ignora combinacions amb modificadors per no xocar amb dreceres
         del sistema/navegador. */
      if (event.metaKey || event.ctrlKey || event.altKey) return

      /* Ignora repeticions per tecla mantinguda: una pulsació, una acció. */
      if (event.repeat) return

      const key = event.key.toLowerCase()
      const shortcut = SHORTCUTS.find((s) => s.key === key)
      if (!shortcut) return

      if (!shortcut.allowInTextField && isEditingTextField()) return
      if (!shortcut.allowInModal && isAnyModalOpen()) return

      event.preventDefault()
      try {
        devLog.action('shortcut:run', shortcut.id)
        shortcut.run(shortcutCtx)
      } catch (err) {
        console.error(`Shortcut "${shortcut.id}" failed`, err)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAnyModalOpen, shortcutCtx])

  return <>{children}</>
}
