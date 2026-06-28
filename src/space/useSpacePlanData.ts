/* Read-only space plan loader for the live supervision view.
   Loads the persisted plan and refreshes it whenever the editor saves (same-tab
   pub/sub). The plan lives in the org now, so cross-tab refresh rides on the same
   pub/sub after a save rather than the window `storage` event. */

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { useMiradorApi } from '../api/mirador-api-context'
import { loadSpacePlan, subscribeSpacePlan } from './space-plan-repository'
import type { SpacePlanData } from './types'

export interface SpacePlanDataState {
  data: SpacePlanData | null
  loaded: boolean
}

export function useSpacePlanData(): SpacePlanDataState {
  const { isMockMode } = useAuth()
  const client = useMiradorApi()
  const [data, setData] = useState<SpacePlanData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const reload = () => {
      void loadSpacePlan(client, isMockMode).then((next) => {
        if (cancelled) return
        setData(next)
        setLoaded(true)
      })
    }

    reload()
    const unsubscribe = subscribeSpacePlan(reload)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [client, isMockMode])

  return { data, loaded }
}
