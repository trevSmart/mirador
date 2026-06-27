/* useRegisterModal — perquè cada overlay informi del seu estat al registre
   amb una sola línia. Sincronitza isOpen amb el registre i neteja en desmuntar. */

import { useEffect } from 'react'
import { useModalRegistry } from './modal-registry-context'

export function useRegisterModal(id: string, isOpen: boolean): void {
  const { setModalState } = useModalRegistry()
  useEffect(() => {
    setModalState(id, isOpen)
    return () => setModalState(id, false)
  }, [id, isOpen, setModalState])
}
