/* Space editor — persistence abstraction.
   Two backends sit behind one seam so consumers never branch on data source:

   - Mock mode: localStorage (with in-memory cache), seeded from
     `createMockSpacePlan()` until the first explicit save.
   - Real mode: a Salesforce-backed store. The plan round-trips through the
     MiradorClient (`/space-plan` GET/PUT), which maps to the Place__c / Space__c
     custom objects server-side. v3 app data is flattened to the v2 wire shape on
     save and re-wrapped into a single site on load until Site__c exists.

   The previous localStorage backend is gone for real mode: the plan now lives in
   the org so it follows the user across browsers and devices. (Local-first caching
   could be layered on top later without touching consumers.) */

import type { MiradorClient } from '../api/mirador-client'
import { createMockSpacePlan } from '../api/mock/mock-space-plan'
import { devLog } from '../dev/dev-log'
import { parseStoredSpacePlan, sanitizeSpacePlan, toWireSpacePlan } from './space-plan-model'
import type { SpacePlanData } from './types'

const MOCK_STORAGE_KEY = 'mirador.spacePlan.v3'

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

function readMockFromStorage(): SpacePlanData | null {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return null
    return parseStoredSpacePlan(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeMockToStorage(data: SpacePlanData): void {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota exceeded or storage unavailable — in-memory cache still holds the plan */
  }
}

/* ---------------------------------------------------------------- mock ---- */

class MockSpacePlanRepository {
  private cache: SpacePlanData | null = null

  private resolved(): SpacePlanData {
    if (this.cache) return this.cache
    this.cache = readMockFromStorage() ?? createMockSpacePlan()
    return this.cache
  }

  load(): Promise<SpacePlanData | null> {
    return Promise.resolve(structuredClone(this.resolved()))
  }

  save(data: SpacePlanData): Promise<void> {
    this.cache = sanitizeSpacePlan(data) ?? data
    writeMockToStorage(this.cache)
    notify()
    return Promise.resolve()
  }

  reset(): void {
    this.cache = createMockSpacePlan()
    try {
      localStorage.removeItem(MOCK_STORAGE_KEY)
    } catch {
      /* ignore */
    }
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
    return stored ? parseStoredSpacePlan(stored) : null
  } catch (error) {
    devLog.api('GET', '/space-plan', `failed: ${String(error)}`)
    return null
  }
}

async function saveToOrg(client: MiradorClient, data: SpacePlanData): Promise<void> {
  const clean = sanitizeSpacePlan(data) ?? data
  await client.saveSpacePlan(toWireSpacePlan(clean))
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
