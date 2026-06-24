/* Read-only floor plan loader for the live supervision view.
   Loads the persisted plan and refreshes it whenever the editor saves (same-tab
   pub/sub) or another tab writes the store (the window `storage` event). */

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import {
  FLOOR_PLAN_STORAGE_KEY,
  loadFloorPlan,
  subscribeFloorPlan,
} from './floor-plan-repository'
import type { FloorPlanData } from './types'

export interface FloorPlanDataState {
  data: FloorPlanData | null
  loaded: boolean
}

export function useFloorPlanData(): FloorPlanDataState {
  const { isMockMode } = useAuth()
  const [data, setData] = useState<FloorPlanData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const reload = () => {
      void loadFloorPlan(isMockMode).then((next) => {
        if (cancelled) return
        setData(next)
        setLoaded(true)
      })
    }

    reload()
    const unsubscribe = subscribeFloorPlan(reload)
    const onStorage = (event: StorageEvent) => {
      if (!isMockMode && event.key === FLOOR_PLAN_STORAGE_KEY) reload()
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
