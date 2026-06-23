/* Floor editor — persistence abstraction.
   Today the plan lives in localStorage. The FloorPlanRepository interface is the
   single seam the rest of the app talks to, so migrating to a Salesforce-backed
   store later means writing one new class and swapping the exported instance —
   no consumer changes. The async API is in place from day one for that reason. */

import { sanitizeFloorPlan } from './floor-plan-model'
import type { FloorPlanData } from './types'

export interface FloorPlanRepository {
  load(): Promise<FloorPlanData | null>
  save(data: FloorPlanData): Promise<void>
}

const STORAGE_KEY = 'mirador.floorPlan.v1'

/* Lightweight pub/sub so the live supervision view reloads the moment the editor
   saves, within the same app instance. Cross-tab updates are handled separately
   by listening to the window `storage` event (see useFloorPlanData). */
type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeFloorPlan(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

export { STORAGE_KEY as FLOOR_PLAN_STORAGE_KEY }

class LocalStorageFloorPlanRepository implements FloorPlanRepository {
  load(): Promise<FloorPlanData | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return Promise.resolve(null)
      return Promise.resolve(sanitizeFloorPlan(JSON.parse(raw)))
    } catch {
      return Promise.resolve(null)
    }
  }

  save(data: FloorPlanData): Promise<void> {
    try {
      const clean = sanitizeFloorPlan(data) ?? data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
      notify()
    } catch {
      /* ignore quota / private-mode storage errors */
    }
    return Promise.resolve()
  }
}

/** The single repository instance the app consumes. Swap this to migrate stores. */
export const floorPlanRepository: FloorPlanRepository = new LocalStorageFloorPlanRepository()
