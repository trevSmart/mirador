/* Space editor — persistence abstraction.
   Today the plan lives in localStorage. The SpacePlanRepository interface is the
   single seam the rest of the app talks to, so migrating to a Salesforce-backed
   store later means writing one new class and swapping the exported instance —
   no consumer changes. The async API is in place from day one for that reason.

   Mock mode uses an in-memory store seeded from `createMockSpacePlan()` so demo
   spaces stay separate from a supervisor's real localStorage plan. */

import { createMockSpacePlan } from '../api/mock/mock-space-plan'
import { sanitizeSpacePlan } from './space-plan-model'
import type { SpacePlanData } from './types'

interface SpacePlanRepository {
  load(): Promise<SpacePlanData | null>
  save(data: SpacePlanData): Promise<void>
}

export const STORAGE_KEY = 'mirador.spacePlan.v1'

/* Lightweight pub/sub so the live supervision view reloads the moment the editor
   saves, within the same app instance. Cross-tab updates are handled separately
   by listening to the window `storage` event (see useSpacePlanData). */
type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeSpacePlan(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

export { STORAGE_KEY as SPACE_PLAN_STORAGE_KEY }

class LocalStorageSpacePlanRepository implements SpacePlanRepository {
  load(): Promise<SpacePlanData | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return Promise.resolve(null)
      return Promise.resolve(sanitizeSpacePlan(JSON.parse(raw)))
    } catch {
      return Promise.resolve(null)
    }
  }

  save(data: SpacePlanData): Promise<void> {
    try {
      const clean = sanitizeSpacePlan(data) ?? data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
      notify()
    } catch {
      /* ignore quota / private-mode storage errors */
    }
    return Promise.resolve()
  }
}

class MockSpacePlanRepository implements SpacePlanRepository {
  private cache: SpacePlanData = createMockSpacePlan()

  load(): Promise<SpacePlanData | null> {
    return Promise.resolve(structuredClone(this.cache))
  }

  save(data: SpacePlanData): Promise<void> {
    this.cache = sanitizeSpacePlan(data) ?? data
    notify()
    return Promise.resolve()
  }

  reset(): void {
    this.cache = createMockSpacePlan()
    notify()
  }
}

const localStorageRepository = new LocalStorageSpacePlanRepository()
const mockRepository = new MockSpacePlanRepository()

export function loadSpacePlan(isMockMode: boolean): Promise<SpacePlanData | null> {
  return isMockMode ? mockRepository.load() : localStorageRepository.load()
}

export function saveSpacePlan(data: SpacePlanData, isMockMode: boolean): Promise<void> {
  return isMockMode ? mockRepository.save(data) : localStorageRepository.save(data)
}
