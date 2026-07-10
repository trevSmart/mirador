import { useCardActivation } from '../hooks/useCardActivation'
import { useDetailDrawer, type DetailTarget } from './detail-drawer-context'

/**
 * Props d'activació per a una fila/card que obre un detall.
 *
 * Un clic (o Enter/Espai) normal obre el drawer; amb Cmd/Ctrl salta el drawer
 * i obre directament el detall com a pestanya.
 */
export function useDetailActivation(target: DetailTarget) {
  const { openAgent, openQueue, openSkill, openWork, openAsTab } = useDetailDrawer()

  return useCardActivation((newTab) => {
    if (newTab) {
      openAsTab(target)
      return
    }
    switch (target.kind) {
      case 'agent':
        return openAgent(target.id)
      case 'queue':
        return openQueue(target.id)
      case 'skill':
        return openSkill(target.id)
      case 'work':
        return openWork(target.id)
    }
  })
}
