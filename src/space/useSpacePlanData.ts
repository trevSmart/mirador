/* Read-only space plan loader for the live supervision view.
   Loads the persisted plan and refreshes it whenever the editor saves (same-tab
   pub/sub) or another tab writes the store (the window `storage` event). */

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import {
  SPACE_PLAN_STORAGE_KEY,
  loadSpacePlan,
  subscribeSpacePlan,
} from './space-plan-repository'
import type { SpacePlanData } from './types'

export interface SpacePlanDataState {
  data: SpacePlanData | null
  loaded: boolean
}

export function useSpacePlanData(): SpacePlanDataState {
  const { isMockMode } = useAuth()
  const [data, setData] = useState<SpacePlanData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const reload = () => {
      void loadSpacePlan(isMockMode).then((next) => {
        if (cancelled) return
        setData(next)
        setLoaded(true)
      })
    }

    reload()
    const unsubscribe = subscribeSpacePlan(reload)
    const onStorage = (event: StorageEvent) => {
      if (!isMockMode && event.key === SPACE_PLAN_STORAGE_KEY) reload()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [isMockMode])

  return { data, loaded }
}
