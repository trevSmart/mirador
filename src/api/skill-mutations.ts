/* Mutació per editar els skills d'un agent. Manté el hook pur: no acobla
   toasts ni cap altra reacció d'UI — el component consumidor passa els seus
   propis `onSuccess`/`onError` a `.mutate(...)`. */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { snapshotPrefix, useSourceClient } from './data-service'
import type { AgentSkillChange, UpdateSkillsResponse } from './types'

export interface UpdateAgentSkillsVars {
  agentId: string
  changes: AgentSkillChange[]
}

export function useUpdateAgentSkills() {
  const client = useSourceClient('salesforce')
  const queryClient = useQueryClient()

  return useMutation<UpdateSkillsResponse, Error, UpdateAgentSkillsVars>({
    mutationFn: ({ agentId, changes }) => {
      if (client === null) {
        throw new Error(
          'No es pot actualitzar els skills: no hi ha sessió activa',
        )
      }
      return client.updateAgentSkills(agentId, { changes })
    },
    onSuccess: () => {
      // Invalidem totes les scopes del snapshot (match per prefix), ja que
      // un canvi de skills afecta tant agents com skills. Retornem la promesa
      // perquè react-query esperi la invalidació abans de resoldre la mutació.
      return queryClient.invalidateQueries({ queryKey: snapshotPrefix() })
    },
  })
}
