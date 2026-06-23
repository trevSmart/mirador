/* Read-only floor plan loader for the live supervision view.
   Loads the persisted plan and refreshes it whenever the editor saves (same-tab
   pub/sub) or another tab writes the store (the window `storage` event). */

import { useEffect, useState } from 'react'
import { FLOOR_PLAN_STORAGE_KEY, floorPlanRepository, subscribeFloorPlan } from './floor-plan-repository'
import type { FloorPlanData } from './types'

export interface FloorPlanDataState {
  data: FloorPlanData | null
  loaded: boolean
}

export function useFloorPlanData(): FloorPlanDataState {
  const [data, setData] = useState<FloorPlanData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const reload = () => {
      void floorPlanRepository.load().then((next) => {
        if (cancelled) return
        setData(next)
        setLoaded(true)
      })
    }

    reload()
    const unsubscribe = subscribeFloorPlan(reload)
    const onStorage = (event: StorageEvent) => {
      if (event.key === FLOOR_PLAN_STORAGE_KEY) reload()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return { data, loaded }
}
