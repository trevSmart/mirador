import { useEffect, useState } from 'react'

/**
 * Segueix si la tecla Alt està premuda ara mateix. Es reinicia en perdre el
 * focus de la finestra (blur) perquè un keyup fora de la finestra no arriba.
 */
export function useAltKey(): boolean {
  const [alt, setAlt] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') setAlt(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') setAlt(false) }
    const blur = () => setAlt(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return alt
}
