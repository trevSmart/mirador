# Site Level With Logo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new root entity `Site` (a call-center building/vendor) above `Place`, each Site carrying a logo image that loads from the app, persists in the record, and shows in the space editor tree.

**Architecture:** A new `Site` interface wraps the existing `Place[]`. The plan round-trips as plain JSON through `/space-plan`, so the logo is stored as a base64 data-URL on `Site.image`. The pure model (`space-plan-model.ts`) gains site-aware sanitisation; the React hook (`useSpacePlan.ts`) gains site CRUD + logo actions; the tree components render the logo; the live supervision view flattens places across sites.

**Tech Stack:** TypeScript, React, Vitest. Tests run with `npm test` (`vitest run`).

## Global Constraints

- UI label for the new level is **"Site"** (keep the anglicism). Catalan copy elsewhere.
- Logo stored as a base64 data-URL string on `Site.image` (no file-upload infra).
- `SPACE_SCHEMA_VERSION` bumps **2 → 3**; v2 plans are discarded on load (existing pattern).
- Logo data-URL must stay under `LOGO_MAX_CHARS = 150_000` chars (Salesforce Long Text limit ~131K, plus margin) — reject larger.
- Logo resized client-side to max `LOGO_MAX_PX = 256` px per side before storing.
- Export/Import cover the whole structure (sites + logos), additive, fresh ids.
- Persistence payload shape is `SpacePlanData` serialised — no `MiradorClient` signature changes.
- Use the pure model functions for every mutation; the hook stays thin.

---

### Task 1: Site type + version bump

**Files:**
- Modify: `src/space/types.ts:41-63`
- Modify: `src/space/space-plan-model.ts:11` (`SPACE_SCHEMA_VERSION`)

**Interfaces:**
- Produces: `Site { id: string; name: string; image: string | null; places: Place[] }`; `SpacePlanData { v: number; activeSiteId: string | null; activePlaceId: string | null; sites: Site[] }`.

- [ ] **Step 1: Add the `Site` interface and rewrite `SpacePlanData`** in `src/space/types.ts`. Replace the current `SpacePlanData` block (lines 58-63) and add `Site` just above it:

```ts
export interface Site {
  id: string
  name: string
  /** Logo as a base64 data-URL ("data:image/png;base64,…"), or null. */
  image: string | null
  places: Place[]
}

export interface SpacePlanData {
  /** Schema version, for forward-compatible migrations. */
  v: number
  activeSiteId: string | null
  activePlaceId: string | null
  sites: Site[]
}
```

- [ ] **Step 2: Bump the schema version** in `src/space/space-plan-model.ts:11`:

```ts
export const SPACE_SCHEMA_VERSION = 3
```

- [ ] **Step 3: Verify the project does not compile yet** (expected — consumers still use `.places`). Run: `npx tsc -b 2>&1 | head -30`. Expected: errors referencing `places`/`activePlaceId` in model, hook, mock, panels. This confirms the surface to migrate. No commit yet — Task 2 makes the model compile.

---

### Task 2: Site-aware model — `sanitizeImage`, `defaultSpacePlan`, `sanitizeSpacePlan`

**Files:**
- Modify: `src/space/space-plan-model.ts` (`defaultSpacePlan` ~109-112, `sanitizeSpacePlan` ~355-384, imports line 5)
- Test: `src/space/space-plan-model.test.ts`

**Interfaces:**
- Consumes: `Site`, `SpacePlanData` from Task 1.
- Produces: `LOGO_MAX_CHARS` const; `sanitizeImage(value: unknown): string | null`; `defaultSpacePlan(): SpacePlanData` (one site); `sanitizeSpacePlan(raw): SpacePlanData | null` (site-aware).

- [ ] **Step 1: Update the test helper to the new shape.** In `src/space/space-plan-model.test.ts`, replace `validPlan` (lines 10-24) so it wraps the place in a site:

```ts
import type { SpacePlanData, Place } from './types'

function validPlace(name = 'Lloc A'): Place {
  return {
    id: 'p1',
    name,
    spaces: [
      { id: 's1', name: 'Planta 1', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0 },
    ],
  }
}

function validPlan(siteName = 'Site A'): SpacePlanData {
  return {
    v: SPACE_SCHEMA_VERSION,
    activeSiteId: 'site1',
    activePlaceId: 'p1',
    sites: [{ id: 'site1', name: siteName, image: null, places: [validPlace()] }],
  }
}
```

- [ ] **Step 2: Write failing tests** for the new model behaviour. Add to `src/space/space-plan-model.test.ts`:

```ts
import { sanitizeImage, sanitizeSpacePlan, defaultSpacePlan } from './space-plan-model'

describe('sanitizeImage', () => {
  it('accepts a valid png data-URL', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeImage(url)).toBe(url)
  })
  it('accepts jpeg, webp and svg data-URLs', () => {
    for (const mime of ['jpeg', 'jpg', 'webp', 'svg+xml']) {
      const url = `data:image/${mime};base64,AAAA`
      expect(sanitizeImage(url)).toBe(url)
    }
  })
  it('rejects non-image strings and non-strings', () => {
    expect(sanitizeImage('hello')).toBeNull()
    expect(sanitizeImage('data:text/plain;base64,AAAA')).toBeNull()
    expect(sanitizeImage(42)).toBeNull()
    expect(sanitizeImage(null)).toBeNull()
  })
  it('rejects an over-long data-URL', () => {
    const url = 'data:image/png;base64,' + 'A'.repeat(200_000)
    expect(sanitizeImage(url)).toBeNull()
  })
})

describe('defaultSpacePlan', () => {
  it('returns exactly one site with one place', () => {
    const plan = defaultSpacePlan()
    expect(plan.v).toBe(SPACE_SCHEMA_VERSION)
    expect(plan.sites).toHaveLength(1)
    expect(plan.sites[0].image).toBeNull()
    expect(plan.sites[0].places).toHaveLength(1)
    expect(plan.activeSiteId).toBe(plan.sites[0].id)
  })
})

describe('sanitizeSpacePlan (sites)', () => {
  it('keeps a valid plan and its logo', () => {
    const plan = validPlan()
    plan.sites[0].image = 'data:image/png;base64,iVBORw0KGgo='
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.sites[0].image).toBe('data:image/png;base64,iVBORw0KGgo=')
  })
  it('nulls an invalid logo but keeps the site', () => {
    const plan = validPlan()
    ;(plan.sites[0] as { image: unknown }).image = 'nope'
    expect(sanitizeSpacePlan(plan)?.sites[0].image).toBeNull()
  })
  it('drops sites with no usable place', () => {
    const plan = validPlan()
    plan.sites.push({ id: 'empty', name: 'Buit', image: null, places: [] })
    expect(sanitizeSpacePlan(plan)?.sites).toHaveLength(1)
  })
  it('falls back activeSiteId/activePlaceId to the first available', () => {
    const plan = validPlan()
    plan.activeSiteId = 'ghost'
    plan.activePlaceId = 'ghost'
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.activeSiteId).toBe(clean?.sites[0].id)
    expect(clean?.activePlaceId).toBe(clean?.sites[0].places[0].id)
  })
  it('rejects a wrong schema version', () => {
    expect(sanitizeSpacePlan({ ...validPlan(), v: 2 })).toBeNull()
  })
})
```

- [ ] **Step 3: Run the new tests — verify they fail.** Run: `npm test -- src/space/space-plan-model.test.ts`. Expected: FAIL (`sanitizeImage` / `defaultSpacePlan` site shape not defined).

- [ ] **Step 4: Implement `sanitizeImage` and `LOGO_MAX_CHARS`.** Add near the top of the Sanitisation section in `src/space/space-plan-model.ts` (after line 11 add the const, and add the function just above `sanitizeSpace`):

```ts
export const LOGO_MAX_CHARS = 150_000

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/

/** Accept only well-formed image data-URLs under the size cap; else null. */
export function sanitizeImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length > LOGO_MAX_CHARS) return null
  return IMAGE_DATA_URL.test(value) ? value : null
}
```

- [ ] **Step 5: Rewrite `defaultSpacePlan`** in `src/space/space-plan-model.ts` (replace lines ~109-112):

```ts
export function defaultSpacePlan(): SpacePlanData {
  const place: Place = { id: makeId('place'), name: 'Lloc 1', spaces: [seedSpace('Planta 1')] }
  const site: Site = { id: makeId('site'), name: 'Site 1', image: null, places: [place] }
  return { v: SPACE_SCHEMA_VERSION, activeSiteId: site.id, activePlaceId: place.id, sites: [site] }
}
```

Add `Site` to the type import on line 5.

- [ ] **Step 6: Rewrite `sanitizeSpacePlan`** (replace lines ~355-384). It now sanitises a place inline and walks sites:

```ts
function sanitizePlace(raw: unknown): Place | null {
  const place = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const spaces = asArray(place.spaces)
    .map((space) => sanitizeSpace(space))
    .filter((space) => space.cells.length > 0)
  if (spaces.length === 0) return null
  return {
    id: typeof place.id === 'string' && place.id ? place.id : makeId('place'),
    name: typeof place.name === 'string' && place.name.trim() ? place.name.trim().slice(0, 40) : 'Lloc',
    spaces,
  }
}

/** Validate a whole plan from storage; returns null when nothing usable. */
export function sanitizeSpacePlan(raw: unknown): SpacePlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== SPACE_SCHEMA_VERSION) return null   // discard old/unknown schema
  if (!Array.isArray(data.sites)) return null

  const sites: Site[] = []
  for (const item of data.sites) {
    const site = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const places = asArray(site.places)
      .map((place) => sanitizePlace(place))
      .filter((place): place is Place => place !== null)
    if (places.length === 0) continue
    sites.push({
      id: typeof site.id === 'string' && site.id ? site.id : makeId('site'),
      name: typeof site.name === 'string' && site.name.trim() ? site.name.trim().slice(0, 40) : 'Site',
      image: sanitizeImage(site.image),
      places,
    })
  }

  if (sites.length === 0) return null
  const activeSiteId =
    typeof data.activeSiteId === 'string' && sites.some((s) => s.id === data.activeSiteId)
      ? data.activeSiteId
      : sites[0].id
  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0]
  const activePlaceId =
    typeof data.activePlaceId === 'string' && activeSite.places.some((p) => p.id === data.activePlaceId)
      ? data.activePlaceId
      : activeSite.places[0].id

  return { v: SPACE_SCHEMA_VERSION, activeSiteId, activePlaceId, sites }
}
```

- [ ] **Step 7: Run the model tests — verify they pass.** Run: `npm test -- src/space/space-plan-model.test.ts`. Expected: PASS for `sanitizeImage`, `defaultSpacePlan`, `sanitizeSpacePlan (sites)`. (`prepareImportedPlaces` tests still fail — fixed in Task 3.)

- [ ] **Step 8: Commit.**

```bash
git add src/space/types.ts src/space/space-plan-model.ts src/space/space-plan-model.test.ts
git commit -m "feat: site-aware model with logo sanitisation"
```

---

### Task 3: Site-aware import — rename `prepareImportedPlaces` → `prepareImportedSites`

**Files:**
- Modify: `src/space/space-plan-model.ts` (`prepareImportedPlaces` ~401-416)
- Test: `src/space/space-plan-model.test.ts`

**Interfaces:**
- Consumes: `sanitizeSpacePlan`, `uniqueName`, `makeId`.
- Produces: `prepareImportedSites(raw: unknown, existingNames: string[]): Site[] | null` — recreates sites with fresh ids (site, place, space), de-dupes site names, preserves each site's `image`.

- [ ] **Step 1: Rewrite the existing `prepareImportedPlaces` tests** in `src/space/space-plan-model.test.ts` to target sites. Replace the `describe('prepareImportedPlaces', …)` block:

```ts
import { prepareImportedSites } from './space-plan-model'

describe('prepareImportedSites', () => {
  it('rejects an incompatible schema version', () => {
    expect(prepareImportedSites({ ...validPlan(), v: 0 }, [])).toBeNull()
  })
  it('recreates sites with fresh ids and preserves the logo', () => {
    const plan = validPlan()
    plan.sites[0].image = 'data:image/png;base64,iVBORw0KGgo='
    const sites = prepareImportedSites(plan, [])
    expect(sites).toHaveLength(1)
    expect(sites?.[0].id).not.toBe('site1')
    expect(sites?.[0].places[0].id).not.toBe('p1')
    expect(sites?.[0].image).toBe('data:image/png;base64,iVBORw0KGgo=')
  })
  it('de-dupes site names against existing names', () => {
    const sites = prepareImportedSites(validPlan('Site A'), ['Site A'])
    expect(sites?.[0].name).toBe('Site A 2')
  })
})
```

Remove the now-stale import of `prepareImportedPlaces` at the top of the file.

- [ ] **Step 2: Run — verify failure.** Run: `npm test -- src/space/space-plan-model.test.ts`. Expected: FAIL (`prepareImportedSites` not exported).

- [ ] **Step 3: Replace `prepareImportedPlaces`** in `src/space/space-plan-model.ts` (lines ~395-416):

```ts
/** Validate an imported plan and turn its sites into brand-new records: every
    site, place and space gets a freshly generated id (so they never collide with
    existing org records) and site names are de-duplicated against
    `existingNames`. Logos are preserved. Additive: nothing here mutates the
    current plan. Returns null when the input is not a usable plan. */
export function prepareImportedSites(raw: unknown, existingNames: string[]): Site[] | null {
  const clean = sanitizeSpacePlan(raw)
  if (!clean) return null

  const names = [...existingNames]
  return clean.sites.map((site) => {
    const name = uniqueName(site.name, names)
    names.push(name)
    return {
      id: makeId('site'),
      name,
      image: site.image,
      places: site.places.map((place) => ({
        id: makeId('place'),
        name: place.name,
        spaces: place.spaces.map((space) => ({ ...space, id: makeId('space') })),
      })),
    }
  })
}
```

- [ ] **Step 4: Run — verify pass.** Run: `npm test -- src/space/space-plan-model.test.ts`. Expected: PASS (whole file green).

- [ ] **Step 5: Commit.**

```bash
git add src/space/space-plan-model.ts src/space/space-plan-model.test.ts
git commit -m "feat: site-aware import (prepareImportedSites)"
```

---

### Task 4: Logo file reader — `src/space/site-logo.ts`

**Files:**
- Create: `src/space/site-logo.ts`
- Test: `src/space/site-logo.test.ts`

**Interfaces:**
- Consumes: `LOGO_MAX_CHARS` from `space-plan-model.ts`.
- Produces: `LOGO_MAX_PX = 256`; `fileToLogoDataUrl(file: File): Promise<string>` — resolves to a resized PNG data-URL (or raw SVG text), rejects with an `Error` (Catalan message) when the file is not an image or the result exceeds `LOGO_MAX_CHARS`.

- [ ] **Step 1: Write failing tests** in `src/space/site-logo.test.ts`. jsdom lacks real canvas decoding, so cover the guard paths (non-image rejected, oversized rejected, SVG passthrough):

```ts
import { describe, expect, it } from 'vitest'
import { fileToLogoDataUrl } from './site-logo'

function fileFrom(content: string, type: string, name = 'f'): File {
  return new File([content], name, { type })
}

describe('fileToLogoDataUrl', () => {
  it('rejects a non-image file', async () => {
    await expect(fileToLogoDataUrl(fileFrom('x', 'text/plain'))).rejects.toThrow(/imatge/i)
  })

  it('passes an SVG through as a data-URL', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'
    const url = await fileToLogoDataUrl(fileFrom(svg, 'image/svg+xml'))
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('rejects an oversized image', async () => {
    const huge = '<svg xmlns="http://www.w3.org/2000/svg">' + 'x'.repeat(200_000) + '</svg>'
    await expect(fileToLogoDataUrl(fileFrom(huge, 'image/svg+xml'))).rejects.toThrow(/gran/i)
  })
})
```

- [ ] **Step 2: Run — verify failure.** Run: `npm test -- src/space/site-logo.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/space/site-logo.ts`.**

```ts
/* Reads an image File and returns a base64 data-URL suitable for Site.image.
   Raster images are downscaled to LOGO_MAX_PX via <canvas> (re-encoded PNG) so
   the data-URL stays well under the Salesforce Long Text cap. SVGs are passed
   through as text. No React, no app state. */

import { LOGO_MAX_CHARS } from './space-plan-model'

export const LOGO_MAX_PX = 256

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No s’ha pogut llegir el fitxer'))
    reader.readAsDataURL(file)
  })
}

function resizeRaster(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No s’ha pogut processar la imatge'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Imatge no vàlida'))
    img.src = dataUrl
  })
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El fitxer ha de ser una imatge')
  }
  const raw = await readAsDataUrl(file)
  const result = file.type === 'image/svg+xml' ? raw : await resizeRaster(raw)
  if (result.length > LOGO_MAX_CHARS) {
    throw new Error('La imatge és massa gran')
  }
  return result
}
```

- [ ] **Step 4: Run — verify pass.** Run: `npm test -- src/space/site-logo.test.ts`. Expected: PASS. (If jsdom cannot construct `Image`, the SVG-passthrough test still passes since it skips the raster path; the two reject tests cover the guards.)

- [ ] **Step 5: Commit.**

```bash
git add src/space/site-logo.ts src/space/site-logo.test.ts
git commit -m "feat: logo file reader with client-side resize"
```

---

### Task 5: Mock plan — wrap places in a site

**Files:**
- Modify: `src/api/mock/mock-space-plan.ts` (imports line 1-2, `createMockSpacePlan` ~67 and the return ~167-171)

**Interfaces:**
- Consumes: `Site`, `SpacePlanData`, `SPACE_SCHEMA_VERSION`.
- Produces: `createMockSpacePlan(): SpacePlanData` returning one site (`mock-site-cc`) wrapping the existing mock place.

- [ ] **Step 1: Add `Site` to the type import** on line 2 of `src/api/mock/mock-space-plan.ts`:

```ts
import type { Cell, Edge, Space, SpacePlanData, Opening, OpeningKind, Place, Seat, Site } from '../../space/types'
```

- [ ] **Step 2: Add a mock site id** next to `MOCK_PLACE_ID` (line ~5):

```ts
const MOCK_SITE_ID = 'mock-site-cc'
```

- [ ] **Step 3: Rewrite the `createMockSpacePlan` return** (lines ~167-171) to wrap the place in a site:

```ts
  const site: Site = { id: MOCK_SITE_ID, name: 'Seu Central', image: null, places: [place] }
  return {
    v: SPACE_SCHEMA_VERSION,
    activeSiteId: site.id,
    activePlaceId: place.id,
    sites: [site],
  }
```

(The `place` local that builds the spaces above stays as-is; only the wrapping return changes.)

- [ ] **Step 4: Verify mock typechecks.** Run: `npx tsc -b 2>&1 | grep mock-space-plan`. Expected: no output (this file is clean; remaining errors are in hook/panels).

- [ ] **Step 5: Commit.**

```bash
git add src/api/mock/mock-space-plan.ts
git commit -m "feat: mock plan wraps places in a site"
```

---

### Task 6: Hook — site navigation, CRUD and logo action

**Files:**
- Modify: `src/space/useSpacePlan.ts`

**Interfaces:**
- Consumes: site-aware model from Tasks 2-3.
- Produces, on the hook return value: `sites`, `activeSite`, `activePlace`, `activeSpace`; existing place/space actions rebased onto the active site; new `addSite()`, `removeSite(siteId)`, `renameSite(siteId, name)`, `selectSite(siteId)`, `setSiteLogo(siteId, dataUrl: string | null)`; `importJson` now uses `prepareImportedSites`.

- [ ] **Step 1: Update imports** in `src/space/useSpacePlan.ts`. On line 25 swap `prepareImportedPlaces` → `prepareImportedSites`; add `Site` to the type import on line 32.

- [ ] **Step 2: Add active-site helpers** after `placeIndex` (line ~47):

```ts
function siteIndex(d: SpacePlanData, siteId: string): number {
  const si = d.sites.findIndex((s) => s.id === siteId)
  return si >= 0 ? si : Math.max(0, d.sites.findIndex((s) => s.id === d.activeSiteId))
}

function activeSiteOf(d: SpacePlanData): { si: number; site: Site } | null {
  const si = Math.max(0, d.sites.findIndex((s) => s.id === d.activeSiteId))
  const site = d.sites[si]
  return site ? { si, site } : null
}
```

- [ ] **Step 3: Rebase `updateActiveSpace`** (lines ~122-139) to navigate site → place → space:

```ts
  const updateActiveSpace = useCallback(
    (fn: (space: Space) => Space, recordHistory = true) => {
      apply((d) => {
        const active = activeSiteOf(d)
        if (!active) return d
        const { si, site } = active
        const pi = Math.max(0, site.places.findIndex((p) => p.id === d.activePlaceId))
        const place = site.places[pi]
        if (!place) return d
        const fi = clampIndex(spaceIndexRef.current, place.spaces.length)
        const space = place.spaces[fi]
        if (!space) return d
        const nextSpace = fn(space)
        if (nextSpace === space) return d
        const spaces = place.spaces.map((f, i) => (i === fi ? nextSpace : f))
        const nextPlaces = site.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
        const sites = d.sites.map((s, i) => (i === si ? { ...s, places: nextPlaces } : s))
        return { ...d, sites }
      }, recordHistory)
    },
    [apply],
  )
```

- [ ] **Step 4: Rebase derived selectors** (lines ~141-145):

```ts
  const activeSiteIndex = Math.max(0, data.sites.findIndex((s) => s.id === data.activeSiteId))
  const activeSite = data.sites[activeSiteIndex] ?? data.sites[0]
  const activePlaceIndex = Math.max(0, activeSite?.places.findIndex((p) => p.id === data.activePlaceId) ?? 0)
  const activePlace = activeSite?.places[activePlaceIndex] ?? activeSite?.places[0] ?? null
  const safeSpaceIndex = clampIndex(activeSpaceIndex, activePlace?.spaces.length ?? 0)
  const activeSpace = activePlace?.spaces[safeSpaceIndex] ?? null
```

- [ ] **Step 5: Rebase place/space CRUD onto the active site.** Every action that today maps `d.places` must now map `activeSite.places`. Replace the bodies of `selectPlace`, `selectSpace`, `addPlace`, `removePlace`, `renamePlace`, `addSpace`, `removeSpace`, `duplicateSpace`, `renameSpace`, `reorderSpace` (lines ~224-345) to operate within the active site. Pattern — a helper that maps the active site's places and re-wraps:

```ts
  const updateActiveSite = useCallback(
    (fn: (site: Site) => Site) => {
      apply((d) => {
        const active = activeSiteOf(d)
        if (!active) return d
        const next = fn(active.site)
        if (next === active.site) return d
        return { ...d, sites: d.sites.map((s, i) => (i === active.si ? next : s)) }
      })
    },
    [apply],
  )
```

Then rewrite each place action through it. Examples (apply the same shape to the rest):

```ts
  const selectPlace = useCallback((placeId: string) => {
    apply((d) => (d.activePlaceId === placeId ? d : { ...d, activePlaceId: placeId }), false)
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const addPlace = useCallback(() => {
    let newPlaceId = ''
    updateActiveSite((site) => {
      const names = site.places.map((p) => p.name)
      const place: Place = {
        id: makeId('place'),
        name: uniqueName(`Lloc ${site.places.length + 1}`, names),
        spaces: [seedSpace('Planta 1')],
      }
      newPlaceId = place.id
      return { ...site, places: [...site.places, place] }
    })
    if (newPlaceId) setData((d) => ({ ...d, activePlaceId: newPlaceId }))
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [updateActiveSite])

  const removePlace = useCallback((placeId: string) => {
    updateActiveSite((site) => {
      if (site.places.length <= 1) return site
      return { ...site, places: site.places.filter((p) => p.id !== placeId) }
    })
    apply((d) => {
      const site = d.sites.find((s) => s.id === d.activeSiteId)
      const activePlaceId = site && !site.places.some((p) => p.id === d.activePlaceId)
        ? site.places[0]?.id ?? d.activePlaceId
        : d.activePlaceId
      return activePlaceId === d.activePlaceId ? d : { ...d, activePlaceId }
    }, false)
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [updateActiveSite, apply])
```

The `addSpace`/`removeSpace`/`duplicateSpace`/`renameSpace`/`reorderSpace`/`renamePlace` actions keep their existing logic but read `site.places` via `updateActiveSite` instead of `d.places` via `placeIndex`. `placeIndex` becomes a lookup within `activeSite.places`. (Keep behaviour identical — only the container changes.)

- [ ] **Step 6: Add site actions** after the place block:

```ts
  const selectSite = useCallback((siteId: string) => {
    apply((d) => {
      if (d.activeSiteId === siteId) return d
      const site = d.sites.find((s) => s.id === siteId)
      return { ...d, activeSiteId: siteId, activePlaceId: site?.places[0]?.id ?? d.activePlaceId }
    }, false)
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const addSite = useCallback(() => {
    apply((d) => {
      const names = d.sites.map((s) => s.name)
      const place: Place = { id: makeId('place'), name: 'Lloc 1', spaces: [seedSpace('Planta 1')] }
      const site: Site = {
        id: makeId('site'),
        name: uniqueName(`Site ${d.sites.length + 1}`, names),
        image: null,
        places: [place],
      }
      return { ...d, sites: [...d.sites, site], activeSiteId: site.id, activePlaceId: place.id }
    })
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const removeSite = useCallback((siteId: string) => {
    apply((d) => {
      if (d.sites.length <= 1) return d
      const sites = d.sites.filter((s) => s.id !== siteId)
      const activeSiteId = d.activeSiteId === siteId ? sites[0].id : d.activeSiteId
      const active = sites.find((s) => s.id === activeSiteId) ?? sites[0]
      const activePlaceId = active.places.some((p) => p.id === d.activePlaceId)
        ? d.activePlaceId
        : active.places[0].id
      return { ...d, sites, activeSiteId, activePlaceId }
    })
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const renameSite = useCallback((siteId: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({
      ...d,
      sites: d.sites.map((s) => (s.id === siteId ? { ...s, name: trimmed } : s)),
    }))
  }, [apply])

  const setSiteLogo = useCallback((siteId: string, dataUrl: string | null) => {
    apply((d) => ({
      ...d,
      sites: d.sites.map((s) => (s.id === siteId ? { ...s, image: dataUrl } : s)),
    }))
  }, [apply])
```

- [ ] **Step 7: Update `importJson`** (line ~397-416) to use sites:

```ts
      const existingNames = dataRef.current.sites.map((s) => s.name)
      const imported = prepareImportedSites(raw, existingNames)
      if (!imported || imported.length === 0) {
        setImportError('Fitxer incompatible o invàlid')
        return
      }
      apply((d) => ({ ...d, sites: [...d.sites, ...imported] }))
```

- [ ] **Step 8: Update the load/reset effects and the returned object.** In the load effect (line ~88) and `reset` (line ~418), nothing changes structurally (they already use `defaultSpacePlan()` and `stored`). Update the returned object (lines ~437-481): replace `places: data.places` with `sites: data.sites`, add `activeSite`, and expose the new actions:

```ts
    sites: data.sites,
    activeSite,
    activePlace,
    // …existing…
    selectSite,
    addSite,
    removeSite,
    renameSite,
    setSiteLogo,
```

- [ ] **Step 9: Typecheck the hook.** Run: `npx tsc -b 2>&1 | grep useSpacePlan`. Expected: no output (panels still error — fixed in Tasks 7-9).

- [ ] **Step 10: Run the full model test suite** to confirm no regression. Run: `npm test -- src/space`. Expected: PASS.

- [ ] **Step 11: Commit.**

```bash
git add src/space/useSpacePlan.ts
git commit -m "feat: site navigation, CRUD and logo action in hook"
```

---

### Task 7: SpaceSidebar — Site node with logo controls

**Files:**
- Modify: `src/components/space/SpaceSidebar.tsx`

**Interfaces:**
- Consumes: hook return from Task 6 (`sites`, `activeSite`, site actions, `setSiteLogo`).
- Produces: a 3-level tree (Site → Place → Space). New props: `sites: Site[]`, `activeSite: Site | null`, `onSelectSite`, `onAddSite`, `onRemoveSite`, `onRenameSite`, `onSetSiteLogo`, `logoError: string | null`, `onClearLogoError`.

- [ ] **Step 1: Update `SpaceSidebarProps`.** Replace `places`/`activePlace` props with site-level props and keep place/space props (now scoped to the active site's places):

```ts
interface SpaceSidebarProps {
  sites: Site[]
  activeSite: Site | null
  activePlace: Place | null
  activeSpaceIndex: number
  onSelectSite: (id: string) => void
  onAddSite: () => void
  onRemoveSite: (id: string) => void
  onRenameSite: (id: string, name: string) => void
  onSetSiteLogo: (id: string, dataUrl: string | null) => void
  logoError: string | null
  onLogoError: (msg: string) => void
  onSelectPlace: (id: string) => void
  onAddPlace: () => void
  onRemovePlace: (id: string) => void
  onRenamePlace: (id: string, name: string) => void
  onSelectSpace: (placeId: string, index: number) => void
  onAddSpace: (placeId: string) => void
  onRemoveSpace: (placeId: string, index: number) => void
  onDuplicateSpace: (placeId: string, index: number) => void
  onRenameSpace: (placeId: string, index: number, name: string) => void
  onReorderSpace: (placeId: string, from: number, to: number) => void
  onExport: () => void
  onImport: () => void
}
```

Add `Site` to the type import on line 2.

- [ ] **Step 2: Add a hidden file input + handler** inside the component, before `return`. The parent owns the error state (passed as `logoError: string | null` and `onLogoError: (msg: string) => void` — Step 1 already lists these). The handler calls `fileToLogoDataUrl` and routes any error to `onLogoError`:

```ts
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null)

  const pickLogo = (siteId: string) => {
    setLogoTargetId(siteId)
    fileInputRef.current?.click()
  }

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !logoTargetId) return
    try {
      const dataUrl = await fileToLogoDataUrl(file)
      onSetSiteLogo(logoTargetId, dataUrl)
    } catch (err) {
      onLogoError(err instanceof Error ? err.message : 'Error en carregar la imatge')
    }
  }
```

Add `import { fileToLogoDataUrl } from '../../space/site-logo'` at the top (the `useRef`/`useState` imports from `react` are already present).

- [ ] **Step 3: Restructure the tree render** so the outer map is over `sites`, each Site node renders the logo/icon + controls, and the existing places map nests one level deeper (over `site.places`). The current `places.map(...)` (lines ~162-330) moves inside a `sites.map(...)` wrapper. Site header markup:

```tsx
<div className="fe-tree__site" role="treeitem" aria-level={1}>
  <button type="button" className="fe-tree__chevron" /* toggle site */ >…</button>
  {site.image
    ? <img className="fe-site__logo" src={site.image} alt="" width={20} height={20} />
    : <SfIcon sprite="standard" symbol="home" sldsSize="x-small" />}
  <EditableLabel className="fe-site__name" value={site.name} onCommit={(n) => onRenameSite(site.id, n)} />
  <button type="button" className="fe-add-btn fe-add-btn--inline" onClick={() => pickLogo(site.id)} title="Carrega un logo">Logo</button>
  {site.image
    ? <button type="button" className="fe-mini-btn" title="Treu el logo" onClick={() => onSetSiteLogo(site.id, null)}>⌫</button>
    : null}
  <button type="button" className="fe-add-btn fe-add-btn--inline" onClick={() => onAddPlace()} title="Afegeix un lloc">+ Lloc</button>
  <button type="button" className="fe-mini-btn" disabled={sites.length <= 1}
    onClick={() => window.confirm(`Vols eliminar el site "${site.name}"?`) && onRemoveSite(site.id)}>✕</button>
</div>
```

Add `SfIcon` import (`import { SfIcon } from '../ds/SfIcon'`). Place nodes keep their current markup but iterate `site.places`; their level becomes 2 and spaces level 3 (`aria-level={2}`/`{3}` updated accordingly). Use `site.id` in the expand/collapse set keys to avoid clashes. Add the hidden input once near the root return:

```tsx
<input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onLogoFile} />
{logoError ? <p className="fe-tree__error" role="alert">{logoError}</p> : null}
```

- [ ] **Step 4: Add a Site button to the panel header** (next to `+ Lloc`):

```tsx
<button type="button" className="fe-add-btn" onClick={onAddSite} title="Afegeix un site">+ Site</button>
```

and update the section title from `Llocs i plantes` to `Sites, llocs i plantes`.

- [ ] **Step 5: Typecheck.** Run: `npx tsc -b 2>&1 | grep SpaceSidebar`. Expected: no output once props line up with Task 8 wiring (may still error until Task 8 passes the new props — acceptable mid-task; confirm after Task 8).

- [ ] **Step 6: Commit.**

```bash
git add src/components/space/SpaceSidebar.tsx
git commit -m "feat: site node with logo controls in sidebar"
```

---

### Task 8: SpaceEditorPanel — wire site props and logo error state

**Files:**
- Modify: `src/panels/SpaceEditorPanel.tsx` (~159-177)

**Interfaces:**
- Consumes: hook (`fp`) site fields/actions; `SpaceSidebar` and `SpacePlanTree` new props.
- Produces: rendered editor with a working Site level.

- [ ] **Step 1: Add local logo-error state** in the panel component:

```tsx
const [logoError, setLogoError] = useState<string | null>(null)
```

- [ ] **Step 2: Pass site props to `SpaceSidebar`** (replace the `<SpaceSidebar … />` block ~159):

```tsx
<SpaceSidebar
  sites={fp.sites}
  activeSite={fp.activeSite}
  activePlace={fp.activePlace}
  activeSpaceIndex={fp.activeSpaceIndex}
  onSelectSite={fp.selectSite}
  onAddSite={fp.addSite}
  onRemoveSite={fp.removeSite}
  onRenameSite={fp.renameSite}
  onSetSiteLogo={fp.setSiteLogo}
  logoError={logoError}
  onLogoError={setLogoError}
  onSelectPlace={fp.selectPlace}
  onAddPlace={fp.addPlace}
  onRemovePlace={fp.removePlace}
  onRenamePlace={fp.renamePlace}
  onSelectSpace={fp.selectSpace}
  onAddSpace={fp.addSpace}
  onRemoveSpace={fp.removeSpace}
  onDuplicateSpace={fp.duplicateSpace}
  onRenameSpace={fp.renameSpace}
  onReorderSpace={fp.reorderSpace}
  onExport={fp.exportJson}
  onImport={/* existing import handler */ undefined as never}
/>
```

Keep the existing `onImport`/`onExport` wiring exactly as it was — only add the new site props; do not change import handling.

- [ ] **Step 3: Pass sites to `SpacePlanTree`** (line ~177):

```tsx
<SpacePlanTree sites={fp.sites} agentsById={agentsById} queuesById={queuesById} />
```

- [ ] **Step 4: Typecheck the panel + sidebar together.** Run: `npx tsc -b 2>&1 | grep -E "SpaceEditorPanel|SpaceSidebar"`. Expected: no output.

- [ ] **Step 5: Commit.**

```bash
git add src/panels/SpaceEditorPanel.tsx
git commit -m "feat: wire site props in space editor panel"
```

---

### Task 9: SpacePlanTree (3D view) + SpacePanel (live view) migration

**Files:**
- Modify: `src/components/space/SpacePlanTree.tsx`
- Modify: `src/panels/SpacePanel.tsx` (~92-97, 168, 183-192)

**Interfaces:**
- Consumes: `Site` shape.
- Produces: `SpacePlanTree` props `{ sites: Site[]; agentsById; queuesById }`; `SpacePanel` reads places flattened across all sites.

- [ ] **Step 1: Rewrite `SpacePlanTree` props and render** to a 3-level tree. Replace `places: Place[]` prop with `sites: Site[]`; outer map over `sites` showing logo-or-icon, then `site.places`, then `place.spaces`:

```tsx
import type { Site } from '../../space/types'

interface SpacePlanTreeProps {
  sites: Site[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

export function SpacePlanTree({ sites, agentsById, queuesById }: SpacePlanTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  // …toggle unchanged…
  return (
    <div className="fe-plan-tree">
      {sites.map((site) => {
        const siteExpanded = !collapsedIds.has(site.id)
        return (
          <div key={site.id} className={`fe-plan-tree__site${siteExpanded ? ' is-expanded' : ''}`}>
            <button type="button" className="fe-plan-tree__chevron" onClick={() => toggle(site.id)} aria-expanded={siteExpanded}>
              {/* same chevron svg */}
            </button>
            {site.image
              ? <img className="fe-plan-tree__logo" src={site.image} alt="" width={16} height={16} />
              : <SfIcon sprite="standard" symbol="home" sldsSize="x-small" />}
            <span className="fe-plan-tree__site-name">{site.name}</span>
            <div className="fe-plan-tree__collapse">
              <div className="fe-plan-tree__collapse-inner">
                {site.places.map((place) => (
                  /* the existing place node markup, iterating place.spaces */
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

The existing place/space markup (lines ~35-74) nests unchanged inside `site.places.map`. Keep `SpacePlanThumb` usage for spaces.

- [ ] **Step 2: Flatten places in `SpacePanel`.** Replace the `activePlace` memo (lines ~92-97):

```tsx
const allPlaces = useMemo(
  () => (data ? data.sites.flatMap((s) => s.places) : []),
  [data],
)
const activePlace = useMemo(() => {
  if (allPlaces.length === 0) return null
  return allPlaces.find((p) => p.id === placeId) ?? allPlaces[0]
}, [allPlaces, placeId])
const spaces = useMemo(() => activePlace?.spaces ?? [], [activePlace])
```

- [ ] **Step 3: Update the guard and selector** (lines ~168, 183-192) to use `allPlaces` instead of `data.places`:

```tsx
if (!data || !activePlace || spaces.length === 0) {
```
```tsx
{allPlaces.length > 1 ? (
  /* Select … options={allPlaces.map((place) => ({ value: place.id, label: place.name }))} */
) : (
  <span className="fv-place-name">{activePlace.name}</span>
)}
```

- [ ] **Step 4: Full typecheck — must be clean now.** Run: `npx tsc -b 2>&1 | head -20`. Expected: no errors (or only the pre-existing DockviewShell/DevConsole build break noted in repo memory — ignore those, they are unrelated).

- [ ] **Step 5: Run the whole test suite.** Run: `npm test`. Expected: PASS. If `SpaceView.test.tsx` fixtures use the old shape, update them to wrap places in a site (`sites: [{ id, name, image: null, places: [...] }]`, add `activeSiteId`).

- [ ] **Step 6: Lint.** Run: `npm run lint`. Expected: clean (lint is a green gate per repo conventions).

- [ ] **Step 7: Commit.**

```bash
git add src/components/space/SpacePlanTree.tsx src/panels/SpacePanel.tsx src/components/space/SpaceView.test.tsx
git commit -m "feat: render site level in tree and live view"
```

---

### Task 10: Logo styles + manual verification

**Files:**
- Modify: the editor/tree stylesheet (find with `grep -rl "fe-plan-tree__place" src`)

**Interfaces:**
- Consumes: the `fe-site__logo`, `fe-plan-tree__logo`, `fe-tree__site`, `fe-plan-tree__site` class names introduced in Tasks 7 and 9.

- [ ] **Step 1: Locate the stylesheet.** Run: `grep -rl "fe-plan-tree__place\|fe-tree__place" src`. Open the matching CSS file.

- [ ] **Step 2: Add logo + site-node styles** mirroring the existing place-node rules (object-fit so logos never distort):

```css
.fe-site__logo,
.fe-plan-tree__logo {
  border-radius: 3px;
  object-fit: contain;
  flex: 0 0 auto;
}
```

Add `.fe-tree__site` / `.fe-plan-tree__site` rules cloned from the existing `.fe-tree__place` / `.fe-plan-tree__place` so spacing/indentation is consistent.

- [ ] **Step 3: Manual verification (mock mode).** Run: `npm run dev:mock`. In the space editor: add a Site, upload a PNG logo (confirm it appears in the sidebar and, after save, persists on reload), remove the logo, add/remove places under a site, export then import the JSON and confirm the logo round-trips. Confirm the 3D/live tree shows the logo.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "feat: logo and site-node styles"
```

---

## Self-Review notes

- **Spec coverage:** model (T1-T2), import/export (T3), logo reader (T4), mock (T5), hook + actions (T6), sidebar UI (T7), panel wiring (T8), 3D tree + live view (T9), styles + manual check (T10). All spec sections mapped.
- **Type consistency:** `Site`, `setSiteLogo`, `prepareImportedSites`, `fileToLogoDataUrl`, `LOGO_MAX_CHARS`, `LOGO_MAX_PX` used consistently across tasks. Sidebar error channel settled on `logoError` + `onLogoError(msg)` (Task 7 Step 2 supersedes the initial `onClearLogoError` sketch; Task 8 wires `setLogoError`).
- **Icon choice:** verified the `standard` sprite has no `company` symbol; the site fallback uses `home` (present in `slds-source/icons.txt`). `address` stays on the place node.
