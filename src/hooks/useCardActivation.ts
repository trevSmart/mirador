import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Props d'activació per a una card/fila clicable (`role="button"`).
 *
 * Centralitza el patró repetit a AgentRow, AgentCard, WorkRow, QueueRow i
 * SkillRow: clic o Enter/Espai obren el detall.
 *
 * El clic ignora el cas en què l'usuari acaba de seleccionar text arrossegant
 * per sobre de la card. El navegador dispara un `click` al `mouseup` sempre que
 * el `mousedown` i el `mouseup` cauen sobre el mateix element, encara que
 * entremig s'hagi fet una selecció; com que qualsevol selecció prèvia es
 * col·lapsa al `mousedown`, una selecció no col·lapsada en el moment del clic
 * només pot provenir d'aquest arrossegament.
 */
export function useCardActivation(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return
      onActivate()
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onActivate()
      }
    },
  }
}
