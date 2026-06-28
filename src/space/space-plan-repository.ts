/* Space editor — persistence abstraction.
   Two backends sit behind one seam so consumers never branch on data source:

   - Mock mode: an in-memory store seeded from `createMockSpacePlan()`, so demo
     spaces stay separate from a supervisor's real data.
   - Real mode: a Salesforce-backed store. The plan round-trips through the
     MiradorClient (`/space-plan` GET/PUT), which maps to the Place__c / Space__c
     custom objects server-side. The async API was in place from day one for this.

   The previous localStorage backend is gone for real mode: the plan now lives in
   the org so it follows the user across browsers and devices. (Local-first caching
   could be layered on top later without touching consumers.) */

import type { MiradorClient } from '../api/mirador-client'
import { createMockSpacePlan } from '../api/mock/mock-space-plan'
import { devLog } from '../dev/dev-log'
import { sanitizeSpacePlan } from './space-plan-model'
import type { SpacePlanData } from './types'

/* Lightweight pub/sub so the live supervision view reloads the moment the editor
   saves, within the same app instance. */
type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeSpacePlan(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

/* ---------------------------------------------------------------- mock ---- */

class MockSpacePlanRepository {
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

const mockRepository = new MockSpacePlanRepository()

/** Exposed for the mock MiradorClient so demo mode shares one in-memory plan. */
export function loadMockSpacePlan(): Promise<SpacePlanData | null> {
  return mockRepository.load()
}

export function saveMockSpacePlan(data: SpacePlanData): Promise<void> {
  return mockRepository.save(data)
}

export function resetMockSpacePlan(): void {
  mockRepository.reset()
}

/* ---------------------------------------------------------- salesforce ---- */

async function loadFromOrg(client: MiradorClient): Promise<SpacePlanData | null> {
  try {
    const stored = await client.getSpacePlan()
    return stored ? sanitizeSpacePlan(stored) : null
  } catch (error) {
    devLog.api('GET', '/space-plan', `failed: ${String(error)}`)
    return null
  }
}

async function saveToOrg(client: MiradorClient, data: SpacePlanData): Promise<void> {
  const clean = sanitizeSpacePlan(data) ?? data
  await client.saveSpacePlan(clean)
  notify()
}

/* ------------------------------------------------------------- public ----- */

export function loadSpacePlan(
  client: MiradorClient | null,
  isMockMode: boolean,
): Promise<SpacePlanData | null> {
  if (isMockMode) return mockRepository.load()
  if (!client) return Promise.resolve(null)
  return loadFromOrg(client)
}

export function saveSpacePlan(
  client: MiradorClient | null,
  data: SpacePlanData,
  isMockMode: boolean,
): Promise<void> {
  if (isMockMode) return mockRepository.save(data)
  if (!client) return Promise.resolve()
  return saveToOrg(client, data)
}
