/* ModalRegistryProvider — l'únic export és el component, així Fast Refresh
   funciona. Context + tipus + hook viuen a ./modal-registry-context. */

import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import {
  ModalRegistryContext,
  type ModalRegistryContextValue,
} from './modal-registry-context'

export function ModalRegistryProvider({ children }: { children: ReactNode }) {
  /* useRef en lloc de state: no necessitem re-renderitzar quan un modal
     s'obre/tanca; només llegim el conjunt en el moment d'una pulsació. */
  const openIds = useRef<Set<string>>(new Set())

  const isAnyModalOpen = useCallback(() => openIds.current.size > 0, [])

  const setModalState = useCallback((id: string, isOpen: boolean) => {
    if (isOpen) {
      openIds.current.add(id)
    } else {
      openIds.current.delete(id)
    }
  }, [])

  const value = useMemo<ModalRegistryContextValue>(
    () => ({ isAnyModalOpen, setModalState }),
    [isAnyModalOpen, setModalState],
  )

  return (
    <ModalRegistryContext.Provider value={value}>
      {children}
    </ModalRegistryContext.Provider>
  )
}
