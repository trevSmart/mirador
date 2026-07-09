/* useFocusTrap — atrapa el focus dins d'un contenidor (modal, drawer) mentre
   està actiu, perquè no es pugui tabular cap a elements de fora.

   En activar-se: recorda qui tenia el focus, i el mou al primer element
   focusable de dins (o al contenidor mateix si no n'hi ha cap). Mentre és
   actiu, Tab i Shift+Tab fan cicle entre el primer i el darrer focusable de
   dins. En desactivar-se (o desmuntar), retorna el focus a qui l'havia obert.

   Retorna un ref que el component ha d'enganxar al contenidor a atrapar. */

import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.tabIndex < 0) return false
    if (el.closest('[hidden],[aria-hidden="true"]')) return false
    return !('disabled' in el && (el as { disabled?: boolean }).disabled)
  })
}

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const container = ref.current
    if (!container) return

    const focusables = focusableWithin(container)
    if (focusables.length === 0) {
      // Sense res on anar, mantenim el focus al contenidor.
      event.preventDefault()
      container.focus()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const activeEl = document.activeElement

    if (event.shiftKey) {
      if (activeEl === first || !container.contains(activeEl)) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault()
        first.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    // Recorda qui tenia el focus abans d'obrir, per restaurar-lo després.
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    // Mou el focus a dins. Si no hi ha res focusable, fa focusable el
    // contenidor mateix perquè el trap tingui on aterrar.
    const focusables = focusableWithin(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      if (!container.hasAttribute('tabindex')) container.tabIndex = -1
      container.focus()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      // Restaura el focus si encara està dins del contenidor (o s'ha perdut
      // cap al body); si l'usuari ja l'ha mogut a un altre lloc, no el robem.
      const toRestore = restoreRef.current
      restoreRef.current = null
      if (!toRestore || !toRestore.isConnected) return
      const activeEl = document.activeElement
      if (activeEl === null || activeEl === document.body || container.contains(activeEl)) {
        toRestore.focus()
      }
    }
  }, [active, handleKeyDown])

  return ref
}
