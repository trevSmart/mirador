# Folder-Tree Space Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed Site → Place → Space hierarchy with an arbitrary-depth **Folder** tree (folders nest freely, each folder has name + image + active, a folder can hold both subfolders AND spaces), persisting the full tree — including folder names and images — to Salesforce.

**Architecture:** A single recursive `Folder` node type replaces both `Site` and `Place`. `Space` (the grid) is unchanged and lives inside folders. The wire/schema version goes to **v4** (a folder tree). The client model reads legacy v2 (flat `places`) and v3 (`sites`) payloads and converts them to folders, so existing plans migrate transparently. Server-side, a new self-referencing `Folder__c` object stores the tree (parent linkage by app-string id, images as base64 in a Long Text field); `Space__c` re-parents from `Place__c` to `Folder__c`.

**Tech Stack:** TypeScript + React (Vite, Vitest), Salesforce Apex + custom-object metadata (SFDX), the existing `MiradorRestHandler` REST seam.

## Global Constraints

- Folder image is base64 stored in a Salesforce **Long Text Area** (max 131,072 chars). `LOGO_MAX_CHARS` MUST be lowered to **120000** so an image always fits with margin.
- Schema version constant `SPACE_SCHEMA_VERSION` MUST be **4**. **No backward compatibility with older schemas** — the app has no other users yet, so there is no legacy v2 (`places`) / v3 (`sites`) data to migrate. `parseStoredSpacePlan` accepts v4 only (delegates to `sanitizeSpacePlan`).
- Folders nest arbitrarily; enforce a hard recursion cap `MAX_FOLDER_DEPTH = 12` in sanitisation to bound untrusted input. Depth is 1-indexed (a root folder is depth 1).
- A folder may contain **both** subfolders and spaces simultaneously. Empty folders are valid and MUST be preserved (they are intentional organisation).
- `Space` type and all its geometry logic (cells/seats/openings/dividers/dir) are UNCHANGED. Do not touch `space-geometry.ts`, `space-iso*.ts`, the grid tools in `addCellRect`/`eraseCell`/`toggleSeat`/`toggleOpening`/`toggleDivider`/`eraseEdge`/`assignAgentToSeat`, or `sanitizeSpace`.
- All user-facing copy stays in Català, matching existing strings.
- Node ids: folders use prefix `folder_`, spaces keep `space_`. Ids are app-generated strings persisted verbatim server-side (never Salesforce record ids).
- Run the TS type check with `npx tsc -b` (NOT `tsc --noEmit` — the project uses project references with `files: []`).

---

## Phases (each is independently shippable and testable)

1. **Model core** — types, sanitisation, visibility, migration, wire, mock. Pure TS + Vitest. No UI, no Apex.
2. **Salesforce persistence** — `Folder__c` metadata, `Space__c` re-parent, `MiradorSpacePlanService` rewrite, Apex tests.
3. **Editor state hook** — `useSpacePlan` rewritten to generic folder/space node operations.
4. **Editor UI** — `SpaceSidebar` (recursive tree + drag), `SpaceEditorPanel` wiring, `SpacePlanTree` preview.
5. **Home / live view + migration cutover** — `SpacePanel` folder navigation, data migration of the org, end-to-end verification.

---

# Phase 1 — Model core

### Task 1: New folder types

**Files:**
- Modify: `src/space/types.ts:54-78`

**Interfaces:**
- Produces: `Folder { id, name, image, active, folders, spaces }`, `SpacePlanData { v, activeFolderId, activeSpaceId, folders }`. `Space`, `Seat`, `Opening`, `Divider`, `Cell`, `Edge`, `Dir`, `OpeningKind`, `SpaceTool` unchanged.

- [ ] **Step 1: Replace `Place` and `Site` interfaces and `SpacePlanData` with the folder model**

Delete the `Place` interface (lines 54-60) and `Site` interface (lines 62-70). Replace the `SpacePlanData` interface (lines 72-78) so the tail of the file reads:

```ts
export interface Space {
  id: string
  name: string
  cells: Cell[]
  seats: Seat[]
  openings: Opening[]
  dividers: Divider[]
  /** Saved camera rotation for this space (0..3, 90° steps). */
  dir: Dir
  /** Whether the space shows up in live views (home/space). Defaults to true. */
  active: boolean
}

/** A recursive organisational node. Replaces the old Site/Place levels: folders
    nest arbitrarily and each can hold BOTH subfolders and spaces. */
export interface Folder {
  id: string
  name: string
  /** Folder image as a base64 data-URL ("data:image/png;base64,…"), or null. */
  image: string | null
  /** Whether the folder (and everything under it) shows up in live views. Defaults to true. */
  active: boolean
  folders: Folder[]
  spaces: Space[]
}

export interface SpacePlanData {
  /** Schema version, for forward-compatible migrations. */
  v: number
  /** Folder whose spaces the editor is currently editing (null = none). */
  activeFolderId: string | null
  /** Space currently selected within the active folder (null = none). */
  activeSpaceId: string | null
  folders: Folder[]
}
```

- [ ] **Step 2: Run the type check to observe the expected breakage**

Run: `npx tsc -b`
Expected: FAIL — every consumer of `Site`/`Place`/`.sites` now errors. This is the map of what the following tasks fix. Note the list; do not fix yet.

- [ ] **Step 3: Commit**

```bash
git add src/space/types.ts
git commit -m "feat(space): replace site/place types with recursive folder model"
```

---

### Task 2: Folder sanitisation + defaults + constants

**Files:**
- Modify: `src/space/space-plan-model.ts` (constants near line 11-12; `defaultSpacePlan` 127-131; `sanitizePlace` 375-387; `sanitizeSpacePlan` 441-475)
- Test: `src/space/space-plan-model.test.ts`

**Interfaces:**
- Consumes: `Folder`, `SpacePlanData` from Task 1; `sanitizeSpace` (unchanged), `sanitizeImage`, `makeId`, `activeFlag`, `asArray`.
- Produces: `SPACE_SCHEMA_VERSION = 4`, `LOGO_MAX_CHARS = 120_000`, `MAX_FOLDER_DEPTH = 12`, `seedFolder(name: string): Folder`, `sanitizeFolder(raw: unknown, depth: number): Folder | null`, `sanitizeSpacePlan(raw): SpacePlanData | null` (folder tree), `defaultSpacePlan(): SpacePlanData`.

- [ ] **Step 1: Write failing tests for sanitisation, defaults and depth cap**

Add to `src/space/space-plan-model.test.ts` (imports will be adjusted in later tasks; add `seedFolder`, `MAX_FOLDER_DEPTH` to the import list now):

```ts
describe('defaultSpacePlan (v4 folders)', () => {
  it('returns one root folder holding one space, both active', () => {
    const plan = defaultSpacePlan()
    expect(plan.v).toBe(4)
    expect(plan.folders).toHaveLength(1)
    expect(plan.folders[0].active).toBe(true)
    expect(plan.folders[0].spaces).toHaveLength(1)
    expect(plan.folders[0].spaces[0].active).toBe(true)
    expect(plan.activeFolderId).toBe(plan.folders[0].id)
    expect(plan.activeSpaceId).toBe(plan.folders[0].spaces[0].id)
  })
})

describe('sanitizeSpacePlan (v4 folder tree)', () => {
  const space = (id: string) => ({ id, name: 'P', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true })

  it('keeps nested folders, images and empty folders', () => {
    const raw = {
      v: 4,
      activeFolderId: 'f1',
      activeSpaceId: null,
      folders: [
        { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [
          { id: 'f2', name: 'B', image: null, active: true, spaces: [], folders: [] },
        ] },
      ],
    }
    const out = sanitizeSpacePlan(raw)
    expect(out).not.toBeNull()
    expect(out!.folders[0].folders[0].id).toBe('f2') // empty folder preserved
  })

  it('rejects a non-v4 schema', () => {
    expect(sanitizeSpacePlan({ v: 3, sites: [] })).toBeNull()
  })

  it('caps recursion at MAX_FOLDER_DEPTH', () => {
    let node: any = { id: 'leaf', name: 'x', image: null, active: true, spaces: [space('sx')], folders: [] }
    for (let i = 0; i < MAX_FOLDER_DEPTH + 5; i += 1) {
      node = { id: `f${i}`, name: 'x', image: null, active: true, spaces: [], folders: [node] }
    }
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: null, activeSpaceId: null, folders: [node] })
    // Walk down and assert depth never exceeds the cap.
    let depth = 0
    let cur = out!.folders[0]
    while (cur.folders.length > 0) { depth += 1; cur = cur.folders[0] }
    expect(depth + 1).toBeLessThanOrEqual(MAX_FOLDER_DEPTH)
  })

  it('falls back activeFolderId/activeSpaceId when the referenced ids are gone', () => {
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: 'nope', activeSpaceId: 'nope', folders: [
      { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [] },
    ] })
    expect(out!.activeFolderId).toBe('f1')
    expect(out!.activeSpaceId).toBe('s1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/space/space-plan-model.test.ts -t "v4"`
Expected: FAIL — `SPACE_SCHEMA_VERSION` is 3, `sanitizeSpacePlan` reads `sites`, `seedFolder`/`MAX_FOLDER_DEPTH` undefined.

- [ ] **Step 3: Update constants**

In `src/space/space-plan-model.ts`, change:

```ts
export const SPACE_SCHEMA_VERSION = 4
export const LOGO_MAX_CHARS = 120_000
export const MAX_FOLDER_DEPTH = 12
```

- [ ] **Step 4: Add `seedFolder` and replace `defaultSpacePlan`**

Replace `defaultSpacePlan` (127-131) and add `seedFolder` just above it:

```ts
export function seedFolder(name: string): Folder {
  return { id: makeId('folder'), name, image: null, active: true, folders: [], spaces: [] }
}

export function defaultSpacePlan(): SpacePlanData {
  const space = seedSpace('Planta 1')
  const folder: Folder = { id: makeId('folder'), name: 'Lloc 1', image: null, active: true, folders: [], spaces: [space] }
  return { v: SPACE_SCHEMA_VERSION, activeFolderId: folder.id, activeSpaceId: space.id, folders: [folder] }
}
```

- [ ] **Step 5: Replace `sanitizePlace` with `sanitizeFolder` and rewrite `sanitizeSpacePlan`**

Delete `sanitizePlace` (375-387). Add:

```ts
/** Validate and clean a folder subtree from untrusted input. Empty folders are
    kept (intentional organisation); recursion is bounded by MAX_FOLDER_DEPTH. */
export function sanitizeFolder(raw: unknown, depth: number): Folder | null {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const spaces = asArray(src.spaces)
    .map((space) => sanitizeSpace(space))
    .filter((space) => space.cells.length > 0)
  const folders = depth >= MAX_FOLDER_DEPTH
    ? []
    : asArray(src.folders)
        .map((child) => sanitizeFolder(child, depth + 1))
        .filter((child): child is Folder => child !== null)
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeId('folder'),
    name: typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 40) : 'Carpeta',
    image: sanitizeImage(src.image),
    active: activeFlag(src.active),
    folders,
    spaces,
  }
}

/** Collect every folder id in the tree (for active-id validation). */
function collectFolderIds(folders: Folder[], out: Set<string>): void {
  for (const f of folders) { out.add(f.id); collectFolderIds(f.folders, out) }
}

/** Collect every space id in the tree. */
function collectSpaceIds(folders: Folder[], out: Set<string>): void {
  for (const f of folders) {
    for (const s of f.spaces) out.add(s.id)
    collectSpaceIds(f.folders, out)
  }
}

/** First space id found in DFS order, or null. */
function firstSpaceId(folders: Folder[]): string | null {
  for (const f of folders) {
    if (f.spaces.length > 0) return f.spaces[0].id
    const nested = firstSpaceId(f.folders)
    if (nested) return nested
  }
  return null
}
```

Rewrite `sanitizeSpacePlan` (441-475):

```ts
export function sanitizeSpacePlan(raw: unknown): SpacePlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== SPACE_SCHEMA_VERSION) return null
  if (!Array.isArray(data.folders)) return null

  const folders = data.folders
    .map((f) => sanitizeFolder(f, 1))
    .filter((f): f is Folder => f !== null)
  if (folders.length === 0) return null

  const folderIds = new Set<string>()
  collectFolderIds(folders, folderIds)
  const spaceIds = new Set<string>()
  collectSpaceIds(folders, spaceIds)

  const activeFolderId =
    typeof data.activeFolderId === 'string' && folderIds.has(data.activeFolderId)
      ? data.activeFolderId
      : folders[0].id
  const activeSpaceId =
    typeof data.activeSpaceId === 'string' && spaceIds.has(data.activeSpaceId)
      ? data.activeSpaceId
      : firstSpaceId(folders)

  return { v: SPACE_SCHEMA_VERSION, activeFolderId, activeSpaceId, folders }
}
```

Update the `import type` line (5) to import `Folder` instead of `Place`/`Site`:

```ts
import type { Cell, Dir, Divider, Edge, Space, SpacePlanData, OpeningKind, Seat, Folder } from './types'
```

- [ ] **Step 6: Remove now-dead `cloneSpace` site refs and stale imports; run tests**

`cloneSpace` (114-125) is unchanged. Run: `npx vitest run src/space/space-plan-model.test.ts -t "v4"`
Expected: PASS. (Other suites in this file still fail — fixed in Task 3/4.)

- [ ] **Step 7: Commit**

```bash
git add src/space/space-plan-model.ts src/space/space-plan-model.test.ts
git commit -m "feat(space): folder sanitisation, defaults and depth cap (v4)"
```

---

### Task 3: Visibility helpers over the folder tree

**Files:**
- Modify: `src/space/space-plan-model.ts:514-532` (replace `visibleSpaces`/`visiblePlaces`)
- Test: `src/space/space-plan-model.test.ts:172-204` (replace the `visiblePlaces / visibleSpaces` describe block)

**Interfaces:**
- Produces: `visibleSpaces(folder: Folder): Space[]`, `VisibleSpaceFolder { folder: Folder; path: string[] }`, `visibleSpaceFolders(data: SpacePlanData): VisibleSpaceFolder[]`.

- [ ] **Step 1: Write failing tests**

Replace the `describe('visiblePlaces / visibleSpaces', …)` block (172-204) with:

```ts
describe('visibleSpaces / visibleSpaceFolders', () => {
  const space = (id: string, active = true) => ({ id, name: id, cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active })
  const plan = (folders: any[]): SpacePlanData => ({ v: 4, activeFolderId: null, activeSpaceId: null, folders })

  it('returns only active spaces of a folder', () => {
    const f = { id: 'f', name: 'F', image: null, active: true, folders: [], spaces: [space('s1'), space('s2', false)] }
    expect(visibleSpaces(f).map((s) => s.id)).toEqual(['s1'])
  })

  it('lists folders that directly hold a visible space, with their path', () => {
    const child = { id: 'c', name: 'Child', image: null, active: true, folders: [], spaces: [space('s1')] }
    const root = { id: 'r', name: 'Root', image: null, active: true, folders: [child], spaces: [] }
    const out = visibleSpaceFolders(plan([root]))
    expect(out).toHaveLength(1)
    expect(out[0].folder.id).toBe('c')
    expect(out[0].path).toEqual(['Root', 'Child'])
  })

  it('hides a folder (and descendants) when it is inactive', () => {
    const child = { id: 'c', name: 'Child', image: null, active: true, folders: [], spaces: [space('s1')] }
    const root = { id: 'r', name: 'Root', image: null, active: false, folders: [child], spaces: [] }
    expect(visibleSpaceFolders(plan([root]))).toHaveLength(0)
  })

  it('hides a folder whose only space is inactive', () => {
    const root = { id: 'r', name: 'Root', image: null, active: true, folders: [], spaces: [space('s1', false)] }
    expect(visibleSpaceFolders(plan([root]))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/space/space-plan-model.test.ts -t "visibleSpaceFolders"`
Expected: FAIL — `visibleSpaceFolders` undefined.

- [ ] **Step 3: Replace the visibility section**

Replace lines 514-532 (the `Live-view visibility` block) with:

```ts
/* ── Live-view visibility ─────────────────────────────────────────────────
   Home and the space view hide anything inactive or hanging off something
   inactive: a folder inside an inactive ancestor is hidden. The editor always
   shows everything so inactive items can be toggled back on. */

/** Active spaces of a folder. */
export function visibleSpaces(folder: Folder): Space[] {
  return folder.spaces.filter((space) => space.active)
}

export interface VisibleSpaceFolder {
  folder: Folder
  /** Ancestor names ending with the folder's own name, for a breadcrumb label. */
  path: string[]
}

/** Every active folder (all ancestors active) that directly holds at least one
    active space, in DFS order, each tagged with its name path. */
export function visibleSpaceFolders(data: SpacePlanData): VisibleSpaceFolder[] {
  const out: VisibleSpaceFolder[] = []
  const walk = (folders: Folder[], parents: string[]): void => {
    for (const folder of folders) {
      if (!folder.active) continue
      const path = [...parents, folder.name]
      if (visibleSpaces(folder).length > 0) out.push({ folder, path })
      walk(folder.folders, path)
    }
  }
  walk(data.folders, [])
  return out
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/space/space-plan-model.test.ts -t "visibleSpaceFolders"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/space/space-plan-model.ts src/space/space-plan-model.test.ts
git commit -m "feat(space): folder-tree visibility helpers"
```

---

### Task 4: Wire format v4 + legacy migration (v2/v3 → folders)

**Files:**
- Modify: `src/space/space-plan-model.ts` (`WireSpacePlanV2` 393-398 → remove; `parseStoredSpacePlan` 401-427; `toWireSpacePlan` 431-438; `LEGACY_WIRE_SITE_ID` 391; `prepareImportedSites` 491-512)
- Modify: `src/api/mirador-client.ts:4,51,53,168-173`
- Test: `src/space/space-plan-model.test.ts:206-226` and the `prepareImportedSites` block (143-170)

**Interfaces:**
- Produces: `WireSpacePlan = SpacePlanData` (v4 is the wire shape now); `parseStoredSpacePlan(raw): SpacePlanData | null` (accepts v4, legacy v3 `sites`, legacy v2 `places`); `toWireSpacePlan(data): SpacePlanData`; `prepareImportedFolders(raw, existingNames): Folder[] | null`.

- [ ] **Step 1: Write failing round-trip + migration tests**

Replace the `describe('parseStoredSpacePlan / toWireSpacePlan', …)` block (206-226):

```ts
describe('parseStoredSpacePlan / toWireSpacePlan (v4)', () => {
  it('round-trips a v4 folder plan', () => {
    const plan = defaultSpacePlan()
    const wire = toWireSpacePlan(plan)
    expect(wire.v).toBe(4)
    const back = parseStoredSpacePlan(wire)
    expect(back!.folders[0].name).toBe('Lloc 1')
  })

  it('migrates a legacy v3 site plan into folders (site→folder, place→subfolder)', () => {
    const legacy = {
      v: 3,
      activeSiteId: 'site1',
      activePlaceId: 'p1',
      sites: [{ id: 'site1', name: 'Seu', image: 'data:image/png;base64,AAAA', active: true, places: [
        { id: 'p1', name: 'Lloc', active: true, spaces: [
          { id: 's1', name: 'Planta', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true },
        ] },
      ] }],
    }
    const out = parseStoredSpacePlan(legacy)
    expect(out!.folders[0].name).toBe('Seu')
    expect(out!.folders[0].image).toBe('data:image/png;base64,AAAA')
    expect(out!.folders[0].folders[0].name).toBe('Lloc')
    expect(out!.folders[0].folders[0].spaces[0].id).toBe('s1')
  })

  it('migrates a legacy v2 flat-places wire into top-level folders', () => {
    const legacy = {
      v: 2,
      activePlaceId: 'p1',
      places: [{ id: 'p1', name: 'Lloc', active: true, spaces: [
        { id: 's1', name: 'Planta', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true },
      ] }],
    }
    const out = parseStoredSpacePlan(legacy)
    expect(out!.folders[0].name).toBe('Lloc')
    expect(out!.folders[0].spaces[0].id).toBe('s1')
  })
})
```

Replace the `prepareImportedSites` describe block (143-170) — rename to `prepareImportedFolders`:

```ts
describe('prepareImportedFolders', () => {
  const plan = () => ({
    v: 4, activeFolderId: 'f1', activeSpaceId: 's1',
    folders: [{ id: 'f1', name: 'Lloc', image: 'data:image/png;base64,AAAA', active: true, folders: [], spaces: [
      { id: 's1', name: 'Planta', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true },
    ] }],
  })

  it('rejects an incompatible schema version', () => {
    expect(prepareImportedFolders({ v: 2, places: [] }, [])).toBeNull()
  })

  it('recreates folders with fresh ids and preserves images and active flags', () => {
    const out = prepareImportedFolders(plan(), [])
    expect(out).not.toBeNull()
    expect(out![0].id).not.toBe('f1')
    expect(out![0].spaces[0].id).not.toBe('s1')
    expect(out![0].image).toBe('data:image/png;base64,AAAA')
    expect(out![0].active).toBe(true)
  })

  it('de-dupes top-level folder names against existing names', () => {
    const out = prepareImportedFolders(plan(), ['Lloc'])
    expect(out![0].name).toBe('Lloc 2')
  })
})
```

Also update the top-of-file `import` (2-14) to drop `LEGACY_WIRE_SITE_ID`, `prepareImportedSites`, `visiblePlaces` and add `visibleSpaceFolders`, `prepareImportedFolders`, `seedFolder`, `MAX_FOLDER_DEPTH`, `defaultSpacePlan`. And remove the `import type { …, Place } from './types'` → `Folder`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/space/space-plan-model.test.ts`
Expected: FAIL — `prepareImportedFolders` undefined, `toWireSpacePlan` returns v2, `parseStoredSpacePlan` produces `sites`.

- [ ] **Step 3: Rewrite the wire/migration section**

Remove `LEGACY_WIRE_SITE_ID` (391) and `WireSpacePlanV2` (393-398). Replace `parseStoredSpacePlan` (401-427) and `toWireSpacePlan` (431-438) with:

```ts
/** The wire shape is now the v4 plan itself: a folder tree. */
export type WireSpacePlan = SpacePlanData

/** Convert legacy Space geometry-bearing space object as-is (sanitizeFolder
    handles it); helper to turn a legacy Place into a Folder. */
function placeToFolder(raw: unknown): unknown {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { id: p.id, name: p.name, image: null, active: p.active, spaces: p.spaces, folders: [] }
}

/** Accept a v4 folder plan, or migrate a legacy v3 (`sites`) / v2 (`places`)
    payload into folders. Sites become top-level folders; their places become
    subfolders; flat v2 places become top-level folders. */
export function parseStoredSpacePlan(raw: unknown): SpacePlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>

  if (data.v === SPACE_SCHEMA_VERSION && Array.isArray(data.folders)) {
    return sanitizeSpacePlan(data)
  }

  // Legacy v3: sites → folders, places → subfolders.
  if (Array.isArray(data.sites)) {
    const folders = (data.sites as unknown[]).map((s) => {
      const site = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
      return {
        id: site.id, name: site.name, image: site.image, active: site.active,
        spaces: [],
        folders: asArray(site.places).map(placeToFolder),
      }
    })
    return sanitizeSpacePlan({ v: SPACE_SCHEMA_VERSION, activeFolderId: null, activeSpaceId: null, folders })
  }

  // Legacy v2 wire: flat places → top-level folders.
  if (Array.isArray(data.places)) {
    const folders = (data.places as unknown[]).map(placeToFolder)
    return sanitizeSpacePlan({ v: SPACE_SCHEMA_VERSION, activeFolderId: null, activeSpaceId: null, folders })
  }

  return null
}

/** The plan is persisted as-is (v4). Sanitised so the server always receives a
    clean tree. */
export function toWireSpacePlan(data: SpacePlanData): WireSpacePlan {
  return sanitizeSpacePlan(data) ?? data
}
```

Replace `prepareImportedSites` (491-512) with `prepareImportedFolders`:

```ts
/** Deep-clone folders with fresh ids (folders and spaces) so imported records
    never collide with existing ones; de-dupe top-level names. Returns null when
    the input is not a usable plan. */
export function prepareImportedFolders(raw: unknown, existingNames: string[]): Folder[] | null {
  const clean = sanitizeSpacePlan(parseStoredSpacePlan(raw) ?? {})
  if (!clean) return null
  const names = [...existingNames]
  const reid = (folder: Folder): Folder => ({
    id: makeId('folder'),
    name: folder.name,
    image: folder.image,
    active: folder.active,
    spaces: folder.spaces.map((s) => ({ ...s, id: makeId('space') })),
    folders: folder.folders.map(reid),
  })
  return clean.folders.map((folder) => {
    const name = uniqueName(folder.name, names)
    names.push(name)
    return { ...reid(folder), name }
  })
}
```

- [ ] **Step 4: Update the API client types**

In `src/api/mirador-client.ts`:
- Line 4: `import type { WireSpacePlan } from '../space/space-plan-model'`
- Lines 51/53: `getSpacePlan: () => Promise<WireSpacePlan | null>` and `saveSpacePlan: (plan: WireSpacePlan) => Promise<void>`
- Lines 168/170: `getSpacePlan: () => request<WireSpacePlan | null>('/space-plan')` and the `saveSpacePlan` body unchanged (still `request('/space-plan', { method: 'PUT', body: JSON.stringify(plan) })`).

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/space/space-plan-model.test.ts`
Expected: PASS for all v4/migration/import tests. (`sanitizeSpacePlan (sites)` and `defaultSpacePlan` old blocks were replaced in Tasks 2-3; if any legacy `sites`/`activeSiteId` assertions remain, delete them now.)

- [ ] **Step 6: Commit**

```bash
git add src/space/space-plan-model.ts src/space/space-plan-model.test.ts src/api/mirador-client.ts
git commit -m "feat(space): v4 wire format with legacy v2/v3 migration to folders"
```

---

### Task 5: Mock repository + mock client speak v4

**Files:**
- Modify: `src/api/mock/mock-space-plan.ts` (whole `createMockSpacePlan`)
- Modify: `src/api/mock/mock-client.ts:12,107-116`
- Modify: `src/space/space-plan-repository.ts` (imports + any `sanitizeSpacePlan` usage still valid)
- Test: extend `src/space/space-plan-model.test.ts` or add a mock test

**Interfaces:**
- Consumes: `Folder`, `SpacePlanData`, `SPACE_SCHEMA_VERSION`.
- Produces: `createMockSpacePlan(): SpacePlanData` returning a folder tree with the three demo spaces under one top-level folder.

- [ ] **Step 1: Rewrite the mock builder to output folders**

In `src/api/mock/mock-space-plan.ts`, replace the `place`/`site`/`return` tail (163-177) with a folder tree. The three `buildSpace` results (`vendes`, `atencio`, `suport`) are unchanged:

```ts
const folder: Folder = {
  id: MOCK_PLACE_ID,
  name: 'Contact Center Barcelona',
  image: null,
  active: true,
  folders: [],
  spaces: [vendes, atencio, suport],
}
return {
  v: SPACE_SCHEMA_VERSION,
  activeFolderId: folder.id,
  activeSpaceId: vendes.id,
  folders: [folder],
}
```

Update the import (line 2) to `Folder` instead of `Place, Site`. Remove now-unused `MOCK_SITE_ID`.

- [ ] **Step 2: Verify mock client still round-trips**

`src/api/mock/mock-client.ts` (107-116) uses `toWireSpacePlan`/`parseStoredSpacePlan`, which are now v4 — no change needed beyond confirming the import still resolves. Read those lines and confirm.

- [ ] **Step 3: Run the full model + any mock tests**

Run: `npx vitest run src/space/ src/api/mock/`
Expected: PASS. Then `npx tsc -b` and note remaining errors are only in `useSpacePlan.ts` and UI (fixed in Phases 3-4).

- [ ] **Step 4: Commit**

```bash
git add src/api/mock/mock-space-plan.ts src/api/mock/mock-client.ts src/space/space-plan-repository.ts
git commit -m "feat(space): mock plan and client emit v4 folder tree"
```

---

# Phase 2 — Salesforce persistence

### Task 6: `Folder__c` custom object + fields

**Files:**
- Create: `force-app/main/default/objects/Folder__c/Folder__c.object-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/AppId__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/ParentAppId__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/Image__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/Active__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/SortOrder__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/ActiveFolderId__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/ActiveSpaceId__c.field-meta.xml`
- Create: `force-app/main/default/objects/Folder__c/fields/SchemaVersion__c.field-meta.xml`

**Interfaces:**
- Produces: `Folder__c` with fields `AppId__c` (Text 255, external id), `ParentAppId__c` (Text 255), `Image__c` (LongTextArea 131072), `Active__c` (Checkbox default true), `SortOrder__c` (Number 4,0), `ActiveFolderId__c` (Text 255), `ActiveSpaceId__c` (Text 255), `SchemaVersion__c` (Number 4,0). Standard Name field is Text.

- [ ] **Step 1: Write the object meta** (`Folder__c.object-meta.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <deploymentStatus>Deployed</deploymentStatus>
    <description>A Mirador "Carpeta": a recursive organisational node in the space plan. Replaces the old Site/Place levels. Holds spaces (Space__c) and nests other folders via ParentAppId__c.</description>
    <enableActivities>false</enableActivities>
    <enableBulkApi>true</enableBulkApi>
    <enableFeeds>false</enableFeeds>
    <enableHistory>false</enableHistory>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableSharing>true</enableSharing>
    <enableStreamingApi>true</enableStreamingApi>
    <label>Folder</label>
    <nameField>
        <label>Folder Name</label>
        <type>Text</type>
    </nameField>
    <pluralLabel>Folders</pluralLabel>
    <sharingModel>ReadWrite</sharingModel>
    <visibility>Public</visibility>
</CustomObject>
```

- [ ] **Step 2: Write the field metas**

`AppId__c` (mirror Place__c/AppId__c, externalId true, Text 255): copy `force-app/main/default/objects/Place__c/fields/AppId__c.field-meta.xml` verbatim, description "Client-generated id of the Folder (Folder.id, e.g. \"folder_xxx\")."

`ParentAppId__c` — Text 255, not external id:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>ParentAppId__c</fullName>
    <description>AppId of the parent Folder, or blank for a top-level (root) folder. The tree is rebuilt in memory from AppId/ParentAppId so it survives the round-trip without Salesforce record ids.</description>
    <externalId>false</externalId>
    <label>Parent App Id</label>
    <length>255</length>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>Text</type>
    <unique>false</unique>
</CustomField>
```

`Image__c` — LongTextArea 131072 (mirror Space__c/Geometry__c structure):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Image__c</fullName>
    <description>Folder image as a base64 data-URL. Client caps it at 120000 chars so it always fits this field.</description>
    <externalId>false</externalId>
    <label>Image</label>
    <length>131072</length>
    <required>false</required>
    <trackTrending>false</trackTrending>
    <type>LongTextArea</type>
    <visibleLines>3</visibleLines>
</CustomField>
```

`Active__c` — copy `Place__c/fields/Active__c.field-meta.xml` verbatim (Checkbox default true), description "Whether the Folder (and everything under it) shows up in the live home/space views."

`SortOrder__c` — Number 4,0:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>SortOrder__c</fullName>
    <description>Sibling ordering among folders sharing a parent. Ascending.</description>
    <externalId>false</externalId>
    <label>Sort Order</label>
    <precision>4</precision>
    <required>false</required>
    <scale>0</scale>
    <trackTrending>false</trackTrending>
    <type>Number</type>
    <unique>false</unique>
</CustomField>
```

`ActiveFolderId__c`, `ActiveSpaceId__c` — Text 255 (mirror Place__c/ActivePlaceId__c), descriptions referencing `SpacePlanData.activeFolderId` / `activeSpaceId`.

`SchemaVersion__c` — copy `Place__c/fields/SchemaVersion__c.field-meta.xml` verbatim.

- [ ] **Step 3: Deploy the object**

Run: `sf project deploy start -d force-app/main/default/objects/Folder__c -o <org-alias>`
Expected: Deploy succeeds, `Folder__c` created.

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/objects/Folder__c
git commit -m "feat(sf): Folder__c object for recursive space-plan tree"
```

---

### Task 7: Re-parent `Space__c` from Place to Folder

**Files:**
- Create: `force-app/main/default/objects/Space__c/fields/Folder__c.field-meta.xml`
- Delete (after data migration in Task 12): `force-app/main/default/objects/Space__c/fields/Place__c.field-meta.xml`

**Interfaces:**
- Produces: `Space__c.Folder__c` master-detail → `Folder__c`, relationship name `Spaces`.

- [ ] **Step 1: Add the Folder master-detail field**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Folder__c</fullName>
    <description>The Folder this Space belongs to. Master-detail: deleting the Folder deletes its Spaces.</description>
    <label>Folder</label>
    <referenceTo>Folder__c</referenceTo>
    <relationshipLabel>Spaces</relationshipLabel>
    <relationshipName>Spaces</relationshipName>
    <required>false</required>
    <relationshipOrder>0</relationshipOrder>
    <reparentableMasterDetail>true</reparentableMasterDetail>
    <trackTrending>false</trackTrending>
    <type>MasterDetail</type>
    <writeRequiresMasterRead>false</writeRequiresMasterRead>
</CustomField>
```

> NOTE: A child object may hold at most two master-detail fields. `Space__c` currently has one (`Place__c`); adding `Folder__c` is allowed. The old `Place__c` field is removed in Task 12 **after** legacy data is migrated. Deploying a new master-detail requires existing `Space__c` rows to get a value — since the org will be wiped/migrated in Task 12, deploy this field while `Space__c` is empty, OR deploy together with the Task 12 delete step.

- [ ] **Step 2: Deploy**

Run: `sf project deploy start -d force-app/main/default/objects/Space__c/fields/Folder__c.field-meta.xml -o <org-alias>`
Expected: Succeeds (deploy after the Task 12 pre-delete if rows exist).

- [ ] **Step 3: Commit**

```bash
git add force-app/main/default/objects/Space__c/fields/Folder__c.field-meta.xml
git commit -m "feat(sf): add Space__c → Folder__c master-detail"
```

---

### Task 8: Rewrite `MiradorSpacePlanService` for the folder tree

**Files:**
- Modify: `force-app/main/default/classes/MiradorSpacePlanService.cls` (whole file)

**Interfaces:**
- Produces: `PlanDto { Integer v; String activeFolderId; String activeSpaceId; List<FolderDto> folders; }`, `FolderDto { String id; String name; String image; Boolean active; List<FolderDto> folders; List<SpaceDto> spaces; }`, `getPlan(): PlanDto` (null when empty), `savePlan(PlanDto)` (full replace).

- [ ] **Step 1: Rewrite the DTOs and read path**

Replace `PlanDto`/`PlaceDto` (26-37) with:

```apex
    public class PlanDto {
        public Integer v;
        public String activeFolderId;
        public String activeSpaceId;
        public List<FolderDto> folders;
    }

    public class FolderDto {
        public String id;
        public String name;
        public String image;
        public Boolean active;
        public List<FolderDto> folders;
        public List<SpaceDto> spaces;
    }
```

`SpaceDto`/`SeatDto`/`OpeningDto`/`DividerDto`/`GeometryDto` are unchanged.

Replace `getPlan` (83-123) and `toSpaceDto` stays but reads from `Folder__c`:

```apex
    public static PlanDto getPlan() {
        List<Folder__c> rows = [
            SELECT Id, Name, AppId__c, ParentAppId__c, Image__c, Active__c, SortOrder__c,
                   ActiveFolderId__c, ActiveSpaceId__c, SchemaVersion__c,
                (
                    SELECT Id, Name, AppId__c, Direction__c, SortOrder__c, Geometry__c, Active__c
                    FROM Spaces__r
                    ORDER BY SortOrder__c ASC NULLS LAST, Name ASC
                )
            FROM Folder__c
            ORDER BY SortOrder__c ASC NULLS LAST, CreatedDate ASC
        ];
        if (rows.isEmpty()) {
            return null;
        }

        PlanDto plan = new PlanDto();
        plan.v = DEFAULT_SCHEMA_VERSION;
        plan.folders = new List<FolderDto>();

        // First pass: build a FolderDto per row and index by AppId.
        Map<String, FolderDto> byAppId = new Map<String, FolderDto>();
        Map<String, String> parentOf = new Map<String, String>();
        for (Folder__c f : rows) {
            if (f.SchemaVersion__c != null) { plan.v = (Integer) f.SchemaVersion__c; }
            if (String.isNotBlank(f.ActiveFolderId__c)) { plan.activeFolderId = f.ActiveFolderId__c; }
            if (String.isNotBlank(f.ActiveSpaceId__c)) { plan.activeSpaceId = f.ActiveSpaceId__c; }

            String appId = String.isNotBlank(f.AppId__c) ? f.AppId__c : f.Id;
            FolderDto fd = new FolderDto();
            fd.id = appId;
            fd.name = f.Name;
            fd.image = f.Image__c;
            fd.active = f.Active__c == null ? true : f.Active__c;
            fd.folders = new List<FolderDto>();
            fd.spaces = new List<SpaceDto>();
            for (Space__c s : f.Spaces__r) { fd.spaces.add(toSpaceDto(s)); }
            byAppId.put(appId, fd);
            parentOf.put(appId, f.ParentAppId__c);
        }

        // Second pass: link children to parents; roots go on the plan.
        for (String appId : byAppId.keySet()) {
            String parent = parentOf.get(appId);
            if (String.isNotBlank(parent) && byAppId.containsKey(parent)) {
                byAppId.get(parent).folders.add(byAppId.get(appId));
            } else {
                plan.folders.add(byAppId.get(appId));
            }
        }
        return plan;
    }
```

`toSpaceDto` (125-141) is unchanged.

- [ ] **Step 2: Rewrite the write path (`savePlan`)**

Replace `savePlan` (150-194) and `toSpaceRow` (196-212). `savePlan` walks the tree, flattening to `Folder__c` rows (with `ParentAppId__c`, `SortOrder__c`) and `Space__c` rows:

```apex
    public static void savePlan(PlanDto plan) {
        if (plan == null) {
            throw new SpacePlanException('Missing plan');
        }

        delete [SELECT Id FROM Folder__c];

        if (plan.folders == null || plan.folders.isEmpty()) {
            return;
        }

        Integer version = plan.v == null ? DEFAULT_SCHEMA_VERSION : plan.v;

        // Flatten the tree into folder rows keyed by AppId, and remember each
        // folder's spaces to insert once folder ids exist.
        List<Folder__c> folderRows = new List<Folder__c>();
        Map<String, List<SpaceDto>> spacesByAppId = new Map<String, List<SpaceDto>>();
        flattenFolders(plan.folders, null, version, plan, folderRows, spacesByAppId);
        insert folderRows;

        Map<String, Id> idByAppId = new Map<String, Id>();
        for (Folder__c f : folderRows) { idByAppId.put(f.AppId__c, f.Id); }

        List<Space__c> spaceRows = new List<Space__c>();
        for (String appId : spacesByAppId.keySet()) {
            Id folderId = idByAppId.get(appId);
            Integer order = 0;
            for (SpaceDto sd : spacesByAppId.get(appId)) {
                spaceRows.add(toSpaceRow(sd, folderId, order));
                order++;
            }
        }
        if (!spaceRows.isEmpty()) {
            insert spaceRows;
        }
    }

    private static void flattenFolders(
        List<FolderDto> folders, String parentAppId, Integer version, PlanDto plan,
        List<Folder__c> outRows, Map<String, List<SpaceDto>> outSpaces
    ) {
        Integer order = 0;
        for (FolderDto fd : folders) {
            Folder__c f = new Folder__c();
            f.Name = clip(fd.name, 80);
            f.AppId__c = fd.id;
            f.ParentAppId__c = parentAppId;
            f.Image__c = fd.image;
            f.Active__c = fd.active == null ? true : fd.active;
            f.SortOrder__c = order;
            f.SchemaVersion__c = version;
            f.ActiveFolderId__c = plan.activeFolderId;
            f.ActiveSpaceId__c = plan.activeSpaceId;
            outRows.add(f);
            if (fd.spaces != null) { outSpaces.put(fd.id, fd.spaces); }
            if (fd.folders != null && !fd.folders.isEmpty()) {
                flattenFolders(fd.folders, fd.id, version, plan, outRows, outSpaces);
            }
            order++;
        }
    }

    private static Space__c toSpaceRow(SpaceDto sd, Id folderId, Integer order) {
        Space__c s = new Space__c();
        s.Folder__c = folderId;
        s.Name = clip(sd.name, 80);
        s.AppId__c = sd.id;
        s.Direction__c = sd.dir == null ? 0 : sd.dir;
        s.SortOrder__c = order;
        s.Active__c = sd.active == null ? true : sd.active;

        GeometryDto g = new GeometryDto();
        g.cells = sd.cells == null ? new List<List<Integer>>() : sd.cells;
        g.seats = sd.seats == null ? new List<SeatDto>() : sd.seats;
        g.openings = sd.openings == null ? new List<OpeningDto>() : sd.openings;
        g.dividers = sd.dividers == null ? new List<DividerDto>() : sd.dividers;
        s.Geometry__c = JSON.serialize(g);
        return s;
    }
```

Update `DEFAULT_SCHEMA_VERSION` (22) to `4`. Keep `clip` (214-219) and `SpacePlanException` (221).

- [ ] **Step 3: Update the class header comment** (lines 1-19) to describe the Folder tree, ParentAppId linkage, and Image__c.

- [ ] **Step 4: Commit** (tests run in Task 9)

```bash
git add force-app/main/default/classes/MiradorSpacePlanService.cls
git commit -m "feat(sf): MiradorSpacePlanService reads/writes folder tree (v4)"
```

---

### Task 9: Apex tests for the folder service

**Files:**
- Modify: `force-app/main/default/classes/MiradorSpacePlanServiceTest.cls` (whole file)

**Interfaces:**
- Consumes: the Task 8 DTOs.

- [ ] **Step 1: Rewrite `samplePlan()` to build a nested folder tree**

```apex
    private static MiradorSpacePlanService.PlanDto samplePlan() {
        MiradorSpacePlanService.SpaceDto space = new MiradorSpacePlanService.SpaceDto();
        space.id = 'space_1';
        space.name = 'Planta 1';
        space.dir = 0;
        space.active = true;
        space.cells = new List<List<Integer>>{ new List<Integer>{ 0, 0 } };
        space.seats = new List<MiradorSpacePlanService.SeatDto>();
        space.openings = new List<MiradorSpacePlanService.OpeningDto>();
        space.dividers = new List<MiradorSpacePlanService.DividerDto>();

        MiradorSpacePlanService.FolderDto child = new MiradorSpacePlanService.FolderDto();
        child.id = 'folder_child';
        child.name = 'Lloc';
        child.image = null;
        child.active = true;
        child.folders = new List<MiradorSpacePlanService.FolderDto>();
        child.spaces = new List<MiradorSpacePlanService.SpaceDto>{ space };

        MiradorSpacePlanService.FolderDto root = new MiradorSpacePlanService.FolderDto();
        root.id = 'folder_root';
        root.name = 'Seu';
        root.image = 'data:image/png;base64,AAAA';
        root.active = true;
        root.folders = new List<MiradorSpacePlanService.FolderDto>{ child };
        root.spaces = new List<MiradorSpacePlanService.SpaceDto>();

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 4;
        plan.activeFolderId = 'folder_child';
        plan.activeSpaceId = 'space_1';
        plan.folders = new List<MiradorSpacePlanService.FolderDto>{ root };
        return plan;
    }
```

- [ ] **Step 2: Rewrite the assertions**

Keep `getPlanReturnsNullWhenEmpty`. Rewrite `saveThenGetRoundTrips` to assert the tree rebuilds (root has image, child nested, space geometry preserved, `activeFolderId`/`activeSpaceId` round-trip). Rewrite `savePlanIsFullReplace`, `savePlanWithNoPlacesClears` (rename to `savePlanWithNoFoldersClears`), `savePlanNullThrows`, `longNamesAreClipped`, and the REST tests (`restGetAndPutSpacePlan`, `restPutRejectsEmptyBody`, `restPutRejectsNullPlan`, `restPutRejectsInvalidJson`) — the REST ones only need the JSON body to be a v4 plan. Full code for `saveThenGetRoundTrips`:

```apex
    @IsTest
    static void saveThenGetRoundTrips() {
        Test.startTest();
        MiradorSpacePlanService.savePlan(samplePlan());
        MiradorSpacePlanService.PlanDto out = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(4, out.v);
        System.assertEquals('folder_child', out.activeFolderId);
        System.assertEquals('space_1', out.activeSpaceId);
        System.assertEquals(1, out.folders.size());
        MiradorSpacePlanService.FolderDto root = out.folders[0];
        System.assertEquals('Seu', root.name);
        System.assertEquals('data:image/png;base64,AAAA', root.image);
        System.assertEquals(1, root.folders.size());
        MiradorSpacePlanService.FolderDto child = root.folders[0];
        System.assertEquals('Lloc', child.name);
        System.assertEquals(1, child.spaces.size());
        System.assertEquals('space_1', child.spaces[0].id);
        System.assertEquals(1, child.spaces[0].cells.size());
    }
```

- [ ] **Step 3: Deploy + run tests**

Run: `sf project deploy start -d force-app/main/default/classes/MiradorSpacePlanService.cls -d force-app/main/default/classes/MiradorSpacePlanServiceTest.cls -o <org-alias>`
Then: `sf apex run test -t MiradorSpacePlanServiceTest -o <org-alias> -w 10 -r human`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add force-app/main/default/classes/MiradorSpacePlanServiceTest.cls
git commit -m "test(sf): folder-tree round-trip and REST tests"
```

---

# Phase 3 — Editor state hook

### Task 10: Tree-walk helpers + generic node operations in `useSpacePlan`

**Files:**
- Modify: `src/space/useSpacePlan.ts` (whole file — largest single rewrite)
- Test: Create `src/space/space-tree-ops.test.ts`

**Interfaces:**
- Produces (pure helpers, exported from a new `src/space/space-tree-ops.ts` so they are unit-testable):
  - `findFolder(folders: Folder[], id: string): Folder | null`
  - `updateFolder(folders: Folder[], id: string, fn: (f: Folder) => Folder): Folder[]`
  - `removeFolderById(folders: Folder[], id: string): Folder[]`
  - `insertFolder(folders: Folder[], parentId: string | null, folder: Folder, index: number): Folder[]`
  - `folderContaining(folders: Folder[], spaceId: string): Folder | null`
- Produces (hook return): `data`, `folders`, `activeFolder`, `activeSpace`, `selectedSeat`, `tool`, `dirty`, `canUndo`, `canRedo`, and callbacks: `selectFolder(id)`, `selectSpace(folderId, spaceId)`, `addFolder(parentId | null)`, `removeFolder(id)`, `renameFolder(id, name)`, `toggleFolderActive(id)`, `setFolderImage(id, dataUrl)`, `moveFolder(id, parentId | null, index)`, `addSpace(folderId)`, `removeSpace(folderId, spaceId)`, `duplicateSpace(folderId, spaceId)`, `renameSpace(folderId, spaceId, name)`, `toggleSpaceActive(folderId, spaceId)`, `moveSpace(folderId, from, to)`, plus the UNCHANGED tool/agent/history/persistence callbacks (`setTool`, `paintCellRect`, `eraseCellAt`, `seatAt`, `applyEdge`, `rotateSpace`, `assignAgent`, `removeSeat`, `undo`, `redo`, `save`, `saveError`, `reset`, `exportJson`, `importJson`, `importError`, `clearImportError`).

- [ ] **Step 1: Write failing tests for the pure tree-ops**

Create `src/space/space-tree-ops.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findFolder, updateFolder, removeFolderById, insertFolder, folderContaining } from './space-tree-ops'
import type { Folder } from './types'

const space = (id: string) => ({ id, name: id, cells: [[0, 0]] as [number, number][], seats: [], openings: [], dividers: [], dir: 0 as const, active: true })
const tree = (): Folder[] => ([
  { id: 'r', name: 'R', image: null, active: true, spaces: [space('s0')], folders: [
    { id: 'c', name: 'C', image: null, active: true, spaces: [space('s1')], folders: [] },
  ] },
])

describe('space-tree-ops', () => {
  it('findFolder finds a nested folder', () => {
    expect(findFolder(tree(), 'c')?.name).toBe('C')
  })
  it('updateFolder replaces a nested folder immutably', () => {
    const next = updateFolder(tree(), 'c', (f) => ({ ...f, name: 'C2' }))
    expect(findFolder(next, 'c')?.name).toBe('C2')
  })
  it('removeFolderById drops a subtree', () => {
    expect(findFolder(removeFolderById(tree(), 'c'), 'c')).toBeNull()
  })
  it('insertFolder adds under a parent at an index', () => {
    const f: Folder = { id: 'n', name: 'N', image: null, active: true, spaces: [], folders: [] }
    const next = insertFolder(tree(), 'r', f, 0)
    expect(findFolder(next, 'r')?.folders[0].id).toBe('n')
  })
  it('insertFolder with null parent adds a root', () => {
    const f: Folder = { id: 'n', name: 'N', image: null, active: true, spaces: [], folders: [] }
    expect(insertFolder(tree(), null, f, 0)[0].id).toBe('n')
  })
  it('folderContaining locates the folder holding a space', () => {
    expect(folderContaining(tree(), 's1')?.id).toBe('c')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/space/space-tree-ops.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/space/space-tree-ops.ts`**

```ts
/* Pure, immutable tree operations over the folder plan. No React. */
import type { Folder } from './types'

export function findFolder(folders: Folder[], id: string): Folder | null {
  for (const f of folders) {
    if (f.id === id) return f
    const nested = findFolder(f.folders, id)
    if (nested) return nested
  }
  return null
}

export function updateFolder(folders: Folder[], id: string, fn: (f: Folder) => Folder): Folder[] {
  return folders.map((f) => {
    if (f.id === id) return fn(f)
    if (f.folders.length === 0) return f
    const nested = updateFolder(f.folders, id, fn)
    return nested === f.folders ? f : { ...f, folders: nested }
  })
}

export function removeFolderById(folders: Folder[], id: string): Folder[] {
  return folders
    .filter((f) => f.id !== id)
    .map((f) => (f.folders.length === 0 ? f : { ...f, folders: removeFolderById(f.folders, id) }))
}

export function insertFolder(folders: Folder[], parentId: string | null, folder: Folder, index: number): Folder[] {
  if (parentId === null) {
    const next = [...folders]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, folder)
    return next
  }
  return updateFolder(folders, parentId, (parent) => {
    const children = [...parent.folders]
    children.splice(Math.max(0, Math.min(index, children.length)), 0, folder)
    return { ...parent, folders: children }
  })
}

export function folderContaining(folders: Folder[], spaceId: string): Folder | null {
  for (const f of folders) {
    if (f.spaces.some((s) => s.id === spaceId)) return f
    const nested = folderContaining(f.folders, spaceId)
    if (nested) return nested
  }
  return null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/space/space-tree-ops.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `useSpacePlan.ts` to use the tree-ops**

Rewrite the hook. Key structural changes from the current file:
- Drop `activeSpaceIndex`/`spaceIndexRef`/`activeSiteOf`/`placeIndex`/`clampIndex`. Navigation is now `data.activeFolderId` + `data.activeSpaceId`.
- Derived selectors:
  ```ts
  const activeFolder = useMemo(() => (data.activeFolderId ? findFolder(data.folders, data.activeFolderId) : null), [data])
  const activeSpace = useMemo(() => {
    if (!activeFolder || !data.activeSpaceId) return null
    return activeFolder.spaces.find((s) => s.id === data.activeSpaceId) ?? null
  }, [activeFolder, data.activeSpaceId])
  ```
- `apply` (mutation plumbing with undo/redo) is UNCHANGED (115-126).
- `updateActiveSpace` becomes: find the active folder, map its space with the given id:
  ```ts
  const updateActiveSpace = useCallback((fn: (space: Space) => Space, recordHistory = true) => {
    apply((d) => {
      if (!d.activeFolderId || !d.activeSpaceId) return d
      const folders = updateFolder(d.folders, d.activeFolderId, (folder) => {
        const idx = folder.spaces.findIndex((s) => s.id === d.activeSpaceId)
        if (idx < 0) return folder
        const nextSpace = fn(folder.spaces[idx])
        if (nextSpace === folder.spaces[idx]) return folder
        return { ...folder, spaces: folder.spaces.map((s, i) => (i === idx ? nextSpace : s)) }
      })
      return folders === d.folders ? d : { ...d, folders }
    }, recordHistory)
  }, [apply])
  ```
- Tool callbacks (`paintCellRect`, `eraseCellAt`, `seatAt`, `applyEdge`, `rotateSpace`, `assignAgent`, `removeSeat`) keep their bodies (they call `updateActiveSpace`). `seatAt` reads `activeSpaceRef` — keep that ref, now mirrored from the new `activeSpace`.
- New structure callbacks (replace all site/place/space CRUD):
  ```ts
  const selectFolder = useCallback((id: string) => {
    apply((d) => {
      const folder = findFolder(d.folders, id)
      if (!folder) return d
      return { ...d, activeFolderId: id, activeSpaceId: folder.spaces[0]?.id ?? null }
    }, false)
    setSelectedSeat(null)
  }, [apply])

  const selectSpace = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({ ...d, activeFolderId: folderId, activeSpaceId: spaceId }), false)
    setSelectedSeat(null)
  }, [apply])

  const addFolder = useCallback((parentId: string | null) => {
    let id = ''
    apply((d) => {
      const siblings = parentId ? (findFolder(d.folders, parentId)?.folders ?? []) : d.folders
      const folder = seedFolder(uniqueName(`Carpeta ${siblings.length + 1}`, siblings.map((f) => f.name)))
      id = folder.id
      return { ...d, folders: insertFolder(d.folders, parentId, folder, siblings.length), activeFolderId: folder.id, activeSpaceId: null }
    })
    setSelectedSeat(null)
  }, [apply])

  const removeFolder = useCallback((id: string) => {
    apply((d) => {
      if (d.folders.length <= 1 && d.folders[0]?.id === id) return d // keep at least one root
      const folders = removeFolderById(d.folders, id)
      if (folders === d.folders) return d
      const stillActive = d.activeFolderId && findFolder(folders, d.activeFolderId)
      const nextFolder = stillActive ? d.activeFolderId : folders[0]?.id ?? null
      const nextFolderObj = nextFolder ? findFolder(folders, nextFolder) : null
      return { ...d, folders, activeFolderId: nextFolder, activeSpaceId: nextFolderObj?.spaces[0]?.id ?? null }
    })
    setSelectedSeat(null)
  }, [apply])

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, name: trimmed })) }))
  }, [apply])

  const toggleFolderActive = useCallback((id: string) => {
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, active: !f.active })) }))
  }, [apply])

  const setFolderImage = useCallback((id: string, dataUrl: string | null) => {
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, image: dataUrl })) }))
  }, [apply])

  const moveFolder = useCallback((id: string, parentId: string | null, index: number) => {
    apply((d) => {
      // Reject dropping a folder into its own subtree.
      const moving = findFolder(d.folders, id)
      if (!moving) return d
      if (parentId && (parentId === id || findFolder(moving.folders, parentId))) return d
      const without = removeFolderById(d.folders, id)
      return { ...d, folders: insertFolder(without, parentId, moving, index) }
    })
  }, [apply])
  ```
  Space-level callbacks:
  ```ts
  const addSpace = useCallback((folderId: string) => {
    let spaceId = ''
    apply((d) => {
      const folder = findFolder(d.folders, folderId)
      if (!folder) return d
      const space = seedSpace(uniqueName(`Planta ${folder.spaces.length + 1}`, folder.spaces.map((s) => s.name)))
      spaceId = space.id
      return {
        ...d,
        folders: updateFolder(d.folders, folderId, (f) => ({ ...f, spaces: [...f.spaces, space] })),
        activeFolderId: folderId,
        activeSpaceId: space.id,
      }
    })
    setSelectedSeat(null)
  }, [apply])

  const removeSpace = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => ({ ...f, spaces: f.spaces.filter((s) => s.id !== spaceId) })),
      activeSpaceId: d.activeSpaceId === spaceId ? null : d.activeSpaceId,
    }))
    setSelectedSeat(null)
  }, [apply])

  const duplicateSpace = useCallback((folderId: string, spaceId: string) => {
    apply((d) => updateActiveSpaceless(d, folderId, (folder) => {
      const idx = folder.spaces.findIndex((s) => s.id === spaceId)
      if (idx < 0) return folder
      const source = folder.spaces[idx]
      const copy = cloneSpace(source, uniqueName(`${source.name} (còpia)`, folder.spaces.map((s) => s.name)))
      const spaces = [...folder.spaces.slice(0, idx + 1), copy, ...folder.spaces.slice(idx + 1)]
      return { ...folder, spaces }
    }))
  }, [apply])

  const renameSpace = useCallback((folderId: string, spaceId: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({ ...d, folders: updateFolder(d.folders, folderId, (f) => ({
      ...f, spaces: f.spaces.map((s) => (s.id === spaceId ? { ...s, name: trimmed } : s)),
    })) }))
  }, [apply])

  const toggleSpaceActive = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({ ...d, folders: updateFolder(d.folders, folderId, (f) => ({
      ...f, spaces: f.spaces.map((s) => (s.id === spaceId ? { ...s, active: !s.active } : s)),
    })) }))
  }, [apply])

  const moveSpace = useCallback((folderId: string, from: number, to: number) => {
    if (from === to) return
    apply((d) => ({ ...d, folders: updateFolder(d.folders, folderId, (f) => {
      if (from < 0 || from >= f.spaces.length || to < 0 || to >= f.spaces.length) return f
      const spaces = [...f.spaces]
      const [moved] = spaces.splice(from, 1)
      spaces.splice(to, 0, moved)
      return { ...f, spaces }
    })) }))
  }, [apply])
  ```
  where `updateActiveSpaceless(d, folderId, fn)` is inlined as `{ ...d, folders: updateFolder(d.folders, folderId, fn) }` (spell it out; do not add a helper unless reused).
- `save`/`reset`/`exportJson`/`importJson` bodies are UNCHANGED except `importJson` calls `prepareImportedFolders` and appends to `d.folders`:
  ```ts
  const imported = prepareImportedFolders(raw, dataRef.current.folders.map((f) => f.name))
  if (!imported || imported.length === 0) { setImportError('Fitxer incompatible o invàlid'); return }
  apply((d) => ({ ...d, folders: [...d.folders, ...imported] }))
  ```
- The load effect (94-112) and `reset` (559-571) are unchanged (they call `loadSpacePlan` → `defaultSpacePlan`), except drop `setActiveSpaceIndex(0)`.
- Update the `import` block (11-32) to pull `seedFolder`, `prepareImportedFolders` (drop `defaultSpacePlan` stays, drop `seedSpace` stays, drop `assignAgentToSeat` stays; remove `prepareImportedSites`, `uniqueName` stays) and import the tree-ops from `./space-tree-ops`.
- The returned object exposes the new callbacks (see Interfaces). Remove all `*Site`/`*Place` names.

- [ ] **Step 6: Type-check the hook**

Run: `npx tsc -b`
Expected: Only `src/panels/SpaceEditorPanel.tsx`, `src/components/space/SpaceSidebar.tsx`, `SpacePlanTree.tsx`, and `SpacePanel.tsx` still error (Phase 4/5). `useSpacePlan.ts` itself is clean.

- [ ] **Step 7: Commit**

```bash
git add src/space/space-tree-ops.ts src/space/space-tree-ops.test.ts src/space/useSpacePlan.ts
git commit -m "feat(space): rewrite editor hook around generic folder/space ops"
```

---

# Phase 4 — Editor UI

### Task 11: Recursive folder sidebar + editor panel wiring + preview tree

**Files:**
- Modify: `src/components/space/SpaceSidebar.tsx` (whole component — props + recursive render + drag)
- Modify: `src/panels/SpaceEditorPanel.tsx:160-189` (prop wiring)
- Modify: `src/components/space/SpacePlanTree.tsx:17-122` (recursive read-only tree)
- Modify: `src/space/site-logo.ts` + `src/space/site-logo.test.ts` if they hard-code the old cap (they read `LOGO_MAX_CHARS`; confirm)

**Interfaces:**
- Consumes: the Task 10 hook callbacks.
- Produces: `SpaceSidebar` props: `folders`, `activeFolderId`, `activeSpaceId`, `onSelectFolder`, `onAddFolder`, `onRemoveFolder`, `onRenameFolder`, `onSetFolderImage`, `onToggleFolderActive`, `onMoveFolder`, `onSelectSpace`, `onAddSpace`, `onRemoveSpace`, `onDuplicateSpace`, `onRenameSpace`, `onToggleSpaceActive`, `onMoveSpace`, `onExport`, `onImport`, `logoError`, `onLogoError`.

- [ ] **Step 1: Rewrite `SpaceSidebar` as a recursive tree**

Replace the sites→places→spaces render (current 216-494) with a recursive `FolderNode` sub-component rendered for each root folder. Each `FolderNode` renders, at any depth:
- The folder row: expand chevron, `EditableLabel` (→ `onRenameFolder`), image thumbnail + upload/clear (→ `onSetFolderImage`, reuse the existing `pickLogo`/logo-error flow), active toggle (→ `onToggleFolderActive`), delete (→ `onRemoveFolder`), a `+ Carpeta` button (→ `onAddFolder(folder.id)`) and a `+ Planta` button (→ `onAddSpace(folder.id)`).
- Its child folders: `folder.folders.map((child) => <FolderNode folder={child} depth={depth + 1} … />)`.
- Its spaces: `folder.spaces.map((space, i) => <SpaceRow … />)` reusing the existing space row markup (name → `onRenameSpace(folder.id, space.id, …)`, duplicate → `onDuplicateSpace(folder.id, space.id)`, active → `onToggleSpaceActive(folder.id, space.id)`, delete → `onRemoveSpace(folder.id, space.id)`, select → `onSelectSpace(folder.id, space.id)`).
- Indentation by `depth` (e.g. `style={{ paddingInlineStart: depth * 12 }}` or a CSS class).

Preserve the existing expansion-state and logo-upload machinery (125-170), keying expansion by folder id. Header buttons (187-209): `Importa`/`Exporta` unchanged; replace `+ Lloc`/`+ Site` with a single `+ Carpeta` (→ `onAddFolder(null)`).

Drag-reorder (current 414-435): generalise to (a) reordering spaces within a folder (→ `onMoveSpace(folderId, from, to)`) and (b) moving a folder onto another folder or root (→ `onMoveFolder(id, targetParentId, index)`). The hook's `moveFolder` already rejects dropping a folder into its own subtree, so the UI can attempt any drop and let the model no-op invalid ones.

- [ ] **Step 2: Rewire `SpaceEditorPanel`**

Replace the `<SpaceSidebar … />` props (160-187) with:

```tsx
<SpaceSidebar
  folders={fp.folders}
  activeFolderId={fp.data.activeFolderId}
  activeSpaceId={fp.data.activeSpaceId}
  onSelectFolder={fp.selectFolder}
  onAddFolder={fp.addFolder}
  onRemoveFolder={fp.removeFolder}
  onRenameFolder={fp.renameFolder}
  onSetFolderImage={fp.setFolderImage}
  onToggleFolderActive={fp.toggleFolderActive}
  onMoveFolder={fp.moveFolder}
  onSelectSpace={fp.selectSpace}
  onAddSpace={fp.addSpace}
  onRemoveSpace={fp.removeSpace}
  onDuplicateSpace={fp.duplicateSpace}
  onRenameSpace={fp.renameSpace}
  onToggleSpaceActive={fp.toggleSpaceActive}
  onMoveSpace={fp.moveSpace}
  logoError={logoError}
  onLogoError={setLogoError}
  onExport={fp.exportJson}
  onImport={openImportDialog}
/>
```

And update `<SpacePlanTree sites={fp.sites} … />` (189) to `<SpacePlanTree folders={fp.folders} … />`.

- [ ] **Step 3: Rewrite `SpacePlanTree` (read-only preview) recursively**

Replace its sites→places→spaces render with a recursive folder walk: each folder shows its image (or fallback icon) + name, then its child folders (recurse) and its spaces (`<SpacePlanThumb />` + name), keyed and collapsible by folder id.

- [ ] **Step 4: Type-check + run the editor visually**

Run: `npx tsc -b`
Expected: `SpaceEditorPanel`/`SpaceSidebar`/`SpacePlanTree` clean; only `SpacePanel.tsx` still errors.
Then run the app (`/run` skill or `npm run dev`) and manually confirm: create nested folders, add spaces in a mid-level folder, rename, set an image, toggle active, drag to reorder and reparent, Save.

- [ ] **Step 5: Commit**

```bash
git add src/components/space/SpaceSidebar.tsx src/panels/SpaceEditorPanel.tsx src/components/space/SpacePlanTree.tsx
git commit -m "feat(space): recursive folder sidebar and preview tree"
```

---

# Phase 5 — Home / live view + migration cutover

### Task 12: Home folder navigation

**Files:**
- Modify: `src/panels/SpacePanel.tsx:12,33,94-100,186-198`

**Interfaces:**
- Consumes: `visibleSpaceFolders`, `visibleSpaces` (Task 3).

- [ ] **Step 1: Replace place selection with folder-path selection**

- Import (12): `import { visibleSpaces, visibleSpaceFolders } from '../space/space-plan-model'`.
- Replace `allPlaces`/`activePlace` (94-98) with:
  ```tsx
  const spaceFolders = useMemo(() => (data ? visibleSpaceFolders(data) : []), [data])
  const activeEntry = useMemo(() => {
    if (spaceFolders.length === 0) return null
    return spaceFolders.find((e) => e.folder.id === folderId) ?? spaceFolders[0]
  }, [spaceFolders, folderId])
  const spaces = useMemo(() => (activeEntry ? visibleSpaces(activeEntry.folder) : []), [activeEntry])
  ```
  Rename the `placeId`/`setPlaceId` state (40) to `folderId`/`setFolderId`.
- Empty-state guard (171): `if (!data || !activeEntry || spaces.length === 0)` — keep the same Català copy.
- Selector (186-198): when `spaceFolders.length > 1`, render a `<Select>` whose options are `spaceFolders.map((e) => ({ value: e.folder.id, label: e.path.join(' / ') }))` (breadcrumb label) → `setFolderId`. Otherwise show `activeEntry.path.join(' / ')` as the name. Drop the `spaces[0].name`/`multiSpace` site-name line or keep it reading `activeEntry.folder` spaces.

- [ ] **Step 2: Type-check + full test + build**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: All PASS; production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/panels/SpacePanel.tsx
git commit -m "feat(space): Home navigates the folder tree by breadcrumb"
```

---

### Task 13: Migrate the org's existing plan and remove `Place__c`

**Files:**
- Delete: `force-app/main/default/objects/Place__c/` (whole directory)
- Delete: `force-app/main/default/objects/Space__c/fields/Place__c.field-meta.xml`
- Create: `scripts/apex/delete-legacy-plan.apex`

**Interfaces:** none (operational task).

> This is destructive. **No schema migration is needed** (no legacy data to preserve). Any existing `Place__c`/`Space__c` rows are simply deleted before the master-detail swap. If the user wants to keep a plan they drew under the old code, they can **Exporta** first and **Importa** after — but the folder importer only accepts v4, so an old v3 export would not import; treat that as optional and out of scope.

- [ ] **Step 1: (Optional) back up any current plan** — skip unless the user explicitly wants to keep existing drawings.

- [ ] **Step 2: Delete legacy rows so the master-detail swap can deploy**

Create `scripts/apex/delete-legacy-plan.apex`:

```apex
// One-off: clear legacy Place__c (cascades Space__c) so Space__c can re-parent to Folder__c.
delete [SELECT Id FROM Place__c];
```

Run: `sf apex run -f scripts/apex/delete-legacy-plan.apex -o <org-alias>`
Expected: Success.

- [ ] **Step 3: Deploy the Space__c re-parent + drop Place__c**

Remove `force-app/main/default/objects/Space__c/fields/Place__c.field-meta.xml` and the `Place__c` object directory, then deploy the whole `force-app`:

Run: `sf project deploy start -d force-app/main/default -o <org-alias>`
Expected: Deploy succeeds (Folder__c live, Space__c under Folder__c, Place__c removed).

- [ ] **Step 4: Create a fresh plan and confirm persistence**

In the editor (org now on the Folder schema), create a folder, give it a name + image, add a nested folder and spaces. Click **Desa**, reload the page, and confirm folder names AND images persist (the original bug is fixed).

- [ ] **Step 5: Commit**

```bash
git add -A force-app/main/default/objects scripts/apex/delete-legacy-plan.apex
git commit -m "chore(sf): drop Place__c after migrating to Folder__c tree"
```

---

### Task 14: Final verification sweep

- [ ] **Step 1: Full client verification**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: type check clean, all Vitest suites pass, build OK.

- [ ] **Step 2: Full Apex verification**

Run: `sf apex run test -t MiradorSpacePlanServiceTest -o <org-alias> -w 10 -r human`
Expected: all pass, coverage unchanged or better.

- [ ] **Step 3: Manual end-to-end (the reported bug + the new feature)**

Confirm, in a real org session:
1. Create a folder, give it a name and an image, add a nested folder, add spaces at two depths.
2. **Desa**, reload the page → folder names and images persist (original bug fixed).
3. Home shows a breadcrumb selector; picking a nested folder shows its spaces and seat counts.
4. Toggle a mid-tree folder inactive → it and its descendants vanish from Home, remain in the editor.

- [ ] **Step 4: Final commit / branch wrap-up** — use `superpowers:finishing-a-development-branch`.

---

## Self-Review notes

- **Spec coverage:** arbitrary nesting (Task 1 recursive `Folder`, Task 10 tree-ops), name+image per folder (Tasks 1/6/8/11), mixed subfolders+spaces (`sanitizeFolder` keeps both; sidebar renders both), image as base64 in a custom-object field (Task 6 `Image__c`, Task 8 persists it), complete scope incl. migration (Task 13). Original bug (site name not saved) fixed by persisting folder name/image server-side.
- **Image cap:** `LOGO_MAX_CHARS = 120000` (Task 2) < 131072 field limit (Global Constraints, Task 6).
- **Type consistency:** hook exposes `data.activeFolderId`/`activeSpaceId`; `SpaceEditorPanel` reads `fp.data.activeFolderId`; `SpaceSidebar` prop is `activeFolderId`. `moveFolder`/`moveSpace` names match between Task 10 and Task 11. Apex `FolderDto` field names (`id,name,image,active,folders,spaces`) match the TS `Folder` shape 1:1 so JSON round-trips without conversion.
- **Legacy migration:** `parseStoredSpacePlan` accepts v4, v3 (`sites`), v2 (`places`); tested in Task 4. Server-side, the same client parser handles whatever the pre-migration export contained.
