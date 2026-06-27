/* Modal registry — context + hook (sense components, perquè Fast Refresh
   estigui content). El <ModalRegistryProvider> viu a ModalRegistryProvider.tsx
   i subministra el valor d'aquest context.

   És la font única de veritat sobre si hi ha algun overlay obert (settings,
   detail drawer, dev console). Les dreceres globals la consulten per decidir
   si actuen. */

import { createContext, useContext } from 'react'

export interface ModalRegistryContextValue {
  /** Cert si almenys un modal/overlay registrat està obert ara mateix. */
  isAnyModalOpen: () => boolean
  /** Cada overlay informa del seu estat (normalment via useRegisterModal). */
  setModalState: (id: string, isOpen: boolean) => void
}

export const ModalRegistryContext = createContext<ModalRegistryContextValue | null>(null)

export function useModalRegistry(): ModalRegistryContextValue {
  const ctx = useContext(ModalRegistryContext)
  if (!ctx) {
    throw new Error('useModalRegistry must be used within ModalRegistryProvider')
  }
  return ctx
}
