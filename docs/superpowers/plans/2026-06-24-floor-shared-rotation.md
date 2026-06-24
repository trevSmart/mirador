# Floor Shared Rotation + 50×50 Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a floor's rotation (`dir`) a per-floor value saved in the plan that the editor sets and both viewer views (Floor + Home) respect in 2D and 3D, move rotation buttons to the editor, enlarge the grid to 50×50, and render only the room's real (rotated) bounding box scaled to fill the container.

**Architecture:** Rotation becomes a `Floor.dir` field persisted with the plan. The editor (`useFloorPlan`) mutates it via a `rotateFloor` action with undo/redo; the viewer (`useFloorPlanData`) reads it. Pure geometry helpers (`rotateCell`, `rotateEdge`, `roomBounds2D`) live in `floor-iso.ts` and are consumed by the 2D view. The 3D view already rotates via `projectCell(dir)`; it just needs the plan's `dir` plus SVG scaling. Old saved plans are discarded by schema version (no migration).

**Tech Stack:** React 18 + TypeScript, plain CSS, Vite. No test framework in this repo — verification is `npm run build` (`tsc -b && vite build`) + `npm run lint` (`eslint .`) + manual browser checks. Pure geometry helpers are verified with a temporary throwaway Node check where useful, then by the build.

## Global Constraints

- Grid is **50×50** cells (`GRID_C = GRID_R = 50`); the old 23×16 limit is gone.
- `Dir = 0 | 1 | 2 | 3` (90° steps), already defined in `src/floor/floor-iso.ts:17`.
- `Floor.dir: Dir` is persisted with the plan; new floors default to `dir: 0`.
- Old saved plans are **discarded** on load when the schema version differs (no migration). Bump `FLOOR_SCHEMA_VERSION` 1 → 2.
- Rotation is editable **only in the editor** (FloorToolbar); the Floor/Home views read it read-only.
- Viewer render: compute the **rotated** room bounding box and scale it to fill the container (2D and 3D).
- `npm run lint` MUST stay at 0 errors (CI gate). `npm run build` MUST pass.
- UI copy in Català. Reuse existing `ButtonIcon` (`src/components/ds/ButtonIcon.tsx`) for the rotation buttons.
- HomePanel renders `<FloorPanel />` (HomePanel.tsx:115), so it inherits Floor behavior — do NOT modify HomePanel.

---

### Task 1: Grid 50×50, `Floor.dir` field, schema version discard

**Files:**
- Modify: `src/floor/floor-plan-model.ts` (lines 7-8 `GRID_C`/`GRID_R`; line 12 `FLOOR_SCHEMA_VERSION`; `sanitizeFloor` return ~308-317; `sanitizeFloorPlan` ~321-347; `defaultFloorPlan`/seed builders that construct floors)
- Modify: `src/floor/types.ts` (`Floor` interface, lines 38-49)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Floor.dir: Dir`; `GRID_C === GRID_R === 50`; `FLOOR_SCHEMA_VERSION === 2`; `sanitizeFloorPlan` returns `null` for plans whose `v` !== 2 (so the app falls back to `defaultFloorPlan`).

- [ ] **Step 1: Add `dir` to the `Floor` type**

In `src/floor/types.ts`, import `Dir` and add the field. At the top of the file ensure `Dir` is importable; it lives in `floor-iso.ts`. Add to the `Floor` interface (after `backgroundOpacity`):

```ts
import type { Dir } from './floor-iso'
```
```ts
export interface Floor {
  id: string
  name: string
  cells: Cell[]
  seats: Seat[]
  openings: Opening[]
  dividers: Divider[]
  /** Background image id, or null for none. */
  background: string | null
  /** Background opacity in the [0, 1] range. */
  backgroundOpacity: number
  /** Saved camera rotation for this floor (0..3, 90° steps). */
  dir: Dir
}
```

If `floor-iso.ts` imports from `types.ts` and this creates a cycle, instead define `Dir` inline in `types.ts` (`export type Dir = 0 | 1 | 2 | 3`) and have `floor-iso.ts` import it from `types.ts`. Check the existing import direction first: `floor-iso.ts:6` imports `Cell, Edge` from `./types`, so `types.ts` must NOT import from `floor-iso.ts`. Therefore: MOVE the `Dir` definition into `types.ts` and re-export it from `floor-iso.ts`.

Concretely — in `src/floor/types.ts` add near the other type aliases:
```ts
export type Dir = 0 | 1 | 2 | 3
```
And in `src/floor/floor-iso.ts` replace `export type Dir = 0 | 1 | 2 | 3` (line 17) with:
```ts
import type { Cell, Edge, Dir } from './types'
export type { Dir }
```
(merge with the existing `import type { Cell, Edge } from './types'` on line 6).

- [ ] **Step 2: Bump grid size and schema version**

In `src/floor/floor-plan-model.ts`:
```ts
export const GRID_C = 50
export const GRID_R = 50
```
```ts
export const FLOOR_SCHEMA_VERSION = 2
```

- [ ] **Step 3: Default `dir` in sanitizeFloor and any floor builder**

In `src/floor/floor-plan-model.ts`, the `sanitizeFloor` return object (~308-317) must include `dir`. Read `source.dir` and clamp to 0..3, default 0:
```ts
  const rawDir = num(source.dir)
  const dir = rawDir === 1 || rawDir === 2 || rawDir === 3 ? rawDir : 0
  return {
    id: typeof source.id === 'string' && source.id ? source.id : makeId('floor'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 40) : 'Planta',
    cells,
    seats,
    openings,
    dividers,
    background: typeof source.background === 'string' ? source.background : null,
    backgroundOpacity: opacity === null ? DEFAULT_BG_OPACITY : clamp(opacity, 0, 1),
    dir,
  }
```
Then find every other place that constructs a `Floor` literal (search the file for `cells:` / `makeFloor` / seed builders used by `defaultFloorPlan`). Add `dir: 0` to each such literal so the `Floor` type is satisfied. Run the build (next step) — `tsc` will name every literal still missing `dir`.

- [ ] **Step 4: Discard plans of an older schema version**

In `src/floor/floor-plan-model.ts`, at the top of `sanitizeFloorPlan` (line ~321), after the object/places guards, reject mismatched versions:
```ts
export function sanitizeFloorPlan(raw: unknown): FloorPlanData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== FLOOR_SCHEMA_VERSION) return null   // discard old/unknown schema
  if (!Array.isArray(data.places)) return null
  // …unchanged…
}
```
This makes `floorPlanRepository.load()` return `null` for old data, so both `useFloorPlan` and `useFloorPlanData` fall back to their defaults (a fresh plan).

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds (after adding `dir` to every `Floor` literal `tsc` flagged); lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/floor/types.ts src/floor/floor-plan-model.ts
git commit -m "feat(floor): 50x50 grid, per-floor dir field, schema v2 discard"
```

---

### Task 2: Pure 2D rotation helpers in `floor-iso.ts`

**Files:**
- Modify: `src/floor/floor-iso.ts` (append new pure functions)

**Interfaces:**
- Consumes: `Dir`, `Cell`, `Edge` from `./types`; `GRID_C` (=50) — import from `./floor-plan-model` OR take `N` as a parameter (prefer parameter to avoid a model→iso dependency).
- Produces:
  ```ts
  rotateCell(c: number, r: number, dir: Dir, n: number): [number, number]
  rotateEdge(edge: Edge, dir: Dir): Edge
  roomBounds2D(cells: Cell[], dir: Dir, n: number): { minC: number; minR: number; cols: number; rows: number }
  ```
  These are consumed by the 2D `FloorView` in Task 4.

- [ ] **Step 1: Add `rotateCell`**

Append to `src/floor/floor-iso.ts`. A 90°-CW rotation of a cell within an n×n square:
```ts
/** Rotate a cell 90°·dir clockwise inside an n×n square grid. */
export function rotateCell(c: number, r: number, dir: Dir, n: number): [number, number] {
  if (dir === 1) return [n - 1 - r, c]
  if (dir === 2) return [n - 1 - c, n - 1 - r]
  if (dir === 3) return [r, n - 1 - c]
  return [c, r]
}
```

- [ ] **Step 2: Add `rotateEdge`**

The `Edge` values are `'N' | 'S' | 'E' | 'O'` (O = Oest/West — confirm against `src/floor/types.ts`). A 90°-CW rotation maps N→E→S→O→N:
```ts
/** Rotate a wall edge label 90°·dir clockwise (N→E→S→O). */
export function rotateEdge(edge: Edge, dir: Dir): Edge {
  const order: Edge[] = ['N', 'E', 'S', 'O']
  const i = order.indexOf(edge)
  if (i < 0) return edge
  return order[(i + dir) % 4]
}
```
(If the actual `Edge` union differs, adjust the `order` array to the real labels in their clockwise sequence — read `types.ts` to confirm before writing.)

- [ ] **Step 3: Add `roomBounds2D`**

Bounding box of the rotated cells (the room's real footprint after rotation):
```ts
/** Bounding box of cells after rotation, as grid extents. */
export function roomBounds2D(
  cells: Cell[],
  dir: Dir,
  n: number,
): { minC: number; minR: number; cols: number; rows: number } {
  if (cells.length === 0) return { minC: 0, minR: 0, cols: 1, rows: 1 }
  let minC = Infinity
  let minR = Infinity
  let maxC = -Infinity
  let maxR = -Infinity
  for (const [c, r] of cells) {
    const [rc, rr] = rotateCell(c, r, dir, n)
    minC = Math.min(minC, rc)
    minR = Math.min(minR, rr)
    maxC = Math.max(maxC, rc)
    maxR = Math.max(maxR, rr)
  }
  return { minC, minR, cols: maxC - minC + 1, rows: maxR - minR + 1 }
}
```

- [ ] **Step 4: Sanity-check the rotation math (throwaway)**

Run this one-off check (no test framework; this is a scratch verification, delete after):
```bash
cd /Users/marcpla/Documents/Projectes/Mirador
npx tsx -e "
import { rotateCell, roomBounds2D, rotateEdge } from './src/floor/floor-iso.ts';
// 3 wide x 2 tall room at origin, n=50
const cells = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]];
console.log('dir0', roomBounds2D(cells,0,50)); // cols 3 rows 2
console.log('dir1', roomBounds2D(cells,1,50)); // cols 2 rows 3
console.log('corner dir1', rotateCell(0,0,1,50)); // [49,0]
console.log('edge N dir1', rotateEdge('N',1)); // E
"
```
Expected: dir0 → cols 3 rows 2; dir1 → cols 2 rows 3 (transposed); edge N dir1 → E.
If `npx tsx` is unavailable, skip this step and rely on the build + Task 4 visual check.

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors. (Helpers are unused until Task 4 — TS does not error on unused exports.)

- [ ] **Step 6: Commit**

```bash
git add src/floor/floor-iso.ts
git commit -m "feat(floor): add pure 2D rotation helpers (rotateCell/rotateEdge/roomBounds2D)"
```

---

### Task 3: `rotateFloor` action with undo/redo in `useFloorPlan`

**Files:**
- Modify: `src/floor/useFloorPlan.ts` (add action near other tool actions ~136-185; export it in the return block ~389-431)

**Interfaces:**
- Consumes: `updateActiveFloor(fn, recordHistory)` (existing, useFloorPlan.ts:109); `Dir` from `./types`.
- Produces: `rotateFloor(delta: 1 | -1): void` on the hook's return object. Consumed by FloorEditorPanel/FloorToolbar in Task 5.

- [ ] **Step 1: Add the `rotateFloor` callback**

In `src/floor/useFloorPlan.ts`, near the other tool actions (after `applyEdge`, before history/persistence), add:
```ts
  const rotateFloor = useCallback(
    (delta: 1 | -1) =>
      updateActiveFloor((f) => ({ ...f, dir: (((f.dir + delta) % 4) + 4) % 4 as Dir })),
    [updateActiveFloor],
  )
```
Ensure `Dir` is imported at the top of the file (`import type { … , Dir } from './types'` or wherever the hook imports floor types from — match the existing import line).

- [ ] **Step 2: Export it**

In the hook's return object (~389-431), add under the `// tools` group:
```ts
    rotateFloor,
```

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/floor/useFloorPlan.ts
git commit -m "feat(floor): rotateFloor action with undo/redo in editor hook"
```

---

### Task 4: 2D `FloorView` — accept `dir`, rotate, frame to rotated bbox, scale to container

**Files:**
- Modify: `src/components/floor/FloorView.tsx`
- Modify: `src/index.css` (`.fv-grid` and a new scaling wrapper, near the existing `.fv-grid` rule)

**Interfaces:**
- Consumes: `rotateCell`, `rotateEdge`, `roomBounds2D` (Task 2); `GRID_C` (=50) from `floor-plan-model`.
- Produces: `FloorView` now takes a `dir: Dir` prop. Consumed by FloorPanel in Task 6.

- [ ] **Step 1: Add `dir` to props and rotate cells/seats/edges**

Rewrite `src/components/floor/FloorView.tsx`. Key changes: add `dir` prop; rotate every cell, seat, divider and opening; frame to `roomBounds2D`; wrap the grid in a scaling container. Full file:

```tsx
import { useMemo } from 'react'
import type { Agent, PresenceStatus } from '../../api/types'
import { edgeStyle } from '../../floor/floor-geometry'
import { cellKey, GRID_C } from '../../floor/floor-plan-model'
import { rotateCell, rotateEdge, roomBounds2D } from '../../floor/floor-iso'
import type { Dir, Floor } from '../../floor/types'
import { useSalesforcePhoto } from '../../hooks/useSalesforcePhoto'
import { agentInitials, presenceLabel } from '../../utils/format'
import { Ring } from '../ds'

/** Larger cells than the editor: supervisors read avatars and rings at a glance. */
const VIEW_CELL = 46

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

interface FloorSeatProps {
  agent: Agent
  onSelect: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

function FloorSeat({ agent, onSelect, showAvatars, animations }: FloorSeatProps) {
  const photo = useSalesforcePhoto(agent.photo)
  return (
    <button
      type="button"
      className="fv-seat"
      title={`${agent.name} · ${presenceLabel(agent.status)} · ${agent.used}/${agent.max}`}
      onClick={() => onSelect(agent)}
    >
      <Ring
        used={agent.used}
        max={agent.max}
        color={STATUS_COLOR[agent.status]}
        size={VIEW_CELL - 10}
        photo={showAvatars ? photo : null}
        initials={agentInitials(agent.name)}
        breathe={animations && agent.status === 'busy'}
      />
    </button>
  )
}

interface FloorViewProps {
  floor: Floor
  dir: Dir
  agentsById: Map<string, Agent>
  onSelectAgent: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

export function FloorView({ floor, dir, agentsById, onSelectAgent, showAvatars, animations }: FloorViewProps) {
  // Rotate every element into the camera frame, then crop to the rotated room.
  const rotated = useMemo(() => {
    const cells = floor.cells.map(([c, r]) => rotateCell(c, r, dir, GRID_C))
    const seatByKey = new Map<string, Floor['seats'][number]>()
    for (const seat of floor.seats) {
      const [rc, rr] = rotateCell(seat.c, seat.r, dir, GRID_C)
      seatByKey.set(cellKey(rc, rr), { ...seat, c: rc, r: rr })
    }
    const dividers = floor.dividers.map((d) => {
      const [rc, rr] = rotateCell(d.c, d.r, dir, GRID_C)
      return { ...d, c: rc, r: rr, edge: rotateEdge(d.edge, dir) }
    })
    const openings = floor.openings.map((o) => {
      const [rc, rr] = rotateCell(o.c, o.r, dir, GRID_C)
      return { ...o, c: rc, r: rr, edge: rotateEdge(o.edge, dir) }
    })
    return { cells, seatByKey, dividers, openings }
  }, [floor, dir])

  const bounds = useMemo(() => roomBounds2D(floor.cells, dir, GRID_C), [floor.cells, dir])
  const { minC, minR, cols, rows } = bounds

  return (
    <div className="fv-fit">
      <div
        className="fv-grid"
        style={{ width: cols * VIEW_CELL, height: rows * VIEW_CELL }}
      >
        {floor.background ? (
          <div
            className="fe-grid__bg"
            style={{ opacity: floor.backgroundOpacity }}
            data-bg={floor.background}
          />
        ) : null}

        {rotated.cells.map(([c, r]) => {
          const seat = rotated.seatByKey.get(cellKey(c, r))
          const agent = seat?.agentId ? agentsById.get(seat.agentId) ?? null : null
          return (
            <div
              key={cellKey(c, r)}
              className="fv-cell"
              style={{
                left: (c - minC) * VIEW_CELL,
                top: (r - minR) * VIEW_CELL,
                width: VIEW_CELL,
                height: VIEW_CELL,
              }}
            >
              {seat ? (
                agent ? (
                  <FloorSeat
                    agent={agent}
                    onSelect={onSelectAgent}
                    showAvatars={showAvatars}
                    animations={animations}
                  />
                ) : (
                  <span className="fv-seat fv-seat--vacant" title="Seient lliure" />
                )
              ) : null}
            </div>
          )
        })}

        {rotated.dividers.map((d) => (
          <div
            key={`div-${d.c}-${d.r}-${d.edge}`}
            className="fe-edge fe-edge--divider"
            style={edgeStyle(d.c - minC, d.r - minR, d.edge, VIEW_CELL)}
          />
        ))}

        {rotated.openings.map((o) => (
          <div
            key={`op-${o.c}-${o.r}-${o.edge}`}
            className={`fe-edge fe-edge--${o.kind}`}
            style={edgeStyle(o.c - minC, o.r - minR, o.edge, VIEW_CELL)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the scaling wrapper CSS**

In `src/index.css`, find the `.fv-grid` rule. Add a `.fv-fit` wrapper rule before it that centers and scales the grid to fill the container while preserving aspect ratio:

```css
.fv-fit {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  container-type: size;
  overflow: hidden;
}

.fv-fit > .fv-grid {
  /* Scale the natural-size grid to fit the container, keeping aspect ratio. */
  max-width: 100%;
  max-height: 100%;
}
```

Note: if the existing `.fv-grid` has `position: relative` (required because cells are absolutely positioned), keep it. Do not remove existing `.fv-grid` declarations; only add `.fv-fit`. If after the manual check the grid does not visually scale up to fill (only shrinks), switch to a transform-based scale — but start with this CSS and validate in Step 4.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build fails ONLY at FloorView's caller (FloorPanel still passes no `dir`) — that is fixed in Task 6. To keep this task independently green, temporarily confirm `tsc` errors are limited to `FloorPanel.tsx` missing the `dir` prop. If so, this task's own file is correct. (Reviewer note: Task 4 and Task 6 are tightly coupled on the `dir` prop; the build goes fully green at Task 6.)

Actually, to keep each task building green, DEFER the prop-tightening: in this task, make `dir` optional with a default so the build stays green:
```ts
interface FloorViewProps {
  floor: Floor
  dir?: Dir
  agentsById: Map<string, Agent>
  onSelectAgent: (agent: Agent) => void
  showAvatars: boolean
  animations: boolean
}

export function FloorView({ floor, dir = 0, agentsById, onSelectAgent, showAvatars, animations }: FloorViewProps) {
```
Task 6 will pass the real `dir`. Re-run: `npm run build && npm run lint` → both green.

- [ ] **Step 4: Manual check**

Run: `npm run dev`. Open a Floor (2D view) that has a room not square. It should look the same as before for `dir=0` (no rotation passed yet) but now scaled to fill the panel rather than fixed at 46px cells.
Expected: the room fills the container; nothing clipped; seats/dividers/openings in correct places.

- [ ] **Step 5: Commit**

```bash
git add src/components/floor/FloorView.tsx src/index.css
git commit -m "feat(floor): 2D view rotates room and scales to fill container"
```

---

### Task 5: Move rotation buttons into the editor toolbar

**Files:**
- Modify: `src/components/floor/FloorToolbar.tsx`
- Modify: `src/panels/FloorEditorPanel.tsx` (pass `onRotate`)
- Create: `src/components/floor/rotate-icon-path.ts` (shared SVG path constant)

**Interfaces:**
- Consumes: `rotateFloor(delta)` from `useFloorPlan` (Task 3); `ButtonIcon` (`src/components/ds/ButtonIcon.tsx`).
- Produces: FloorToolbar gains an `onRotate: (delta: 1 | -1) => void` prop.

- [ ] **Step 1: Extract the rotate SVG path to a shared module**

Create `src/components/floor/rotate-icon-path.ts`:
```ts
// Rotate-axis-y icon path, shared visual language with the Panorama floor editor.
// Left button uses it as drawn; right button mirrors it horizontally.
export const ROTATE_ICON_PATH =
  'M11.2797426,14.9868494 L10.1464466,13.8535534 C9.95118446,13.6582912 9.95118446,13.3417088 10.1464466,13.1464466 C10.3417088,12.9511845 10.6582912,12.9511845 10.8535534,13.1464466 L12.8535534,15.1464466 C13.0488155,15.3417088 13.0488155,15.6582912 12.8535534,15.8535534 L10.8535534,17.8535534 C10.6582912,18.0488155 10.3417088,18.0488155 10.1464466,17.8535534 C9.95118446,17.6582912 9.95118446,17.3417088 10.1464466,17.1464466 L11.3044061,15.9884871 C6.13483244,15.8167229 2,13.7413901 2,11 C2,8.13669069 6.51079147,6 12,6 C17.4892085,6 22,8.13669069 22,11 C22,12.5021775 20.7611164,13.8263891 18.6925542,14.7433738 C18.4401046,14.8552836 18.1447329,14.7413536 18.0328231,14.4889039 C17.9209133,14.2364543 18.0348433,13.9410827 18.2872929,13.8291729 C20.0336708,13.0550111 21,12.0221261 21,11 C21,8.89274656 17.0042017,7 12,7 C6.99579829,7 3,8.89274656 3,11 C3,13.0051086 6.6178104,14.8160018 11.2797426,14.9868494 Z'
```

- [ ] **Step 2: Add rotation buttons to the toolbar**

In `src/components/floor/FloorToolbar.tsx`:
- Add `onRotate: (delta: 1 | -1) => void` to `FloorToolbarProps` and destructure it.
- Import `ButtonIcon` and the path:
```ts
import { ButtonIcon } from '../ds/ButtonIcon'
import { ROTATE_ICON_PATH } from './rotate-icon-path'
```
- In the `.fe-toolbar__actions` block, BEFORE the undo button, add:
```tsx
        <ButtonIcon
          className="fe-icon-btn"
          title="Gira a l'esquerra"
          aria-label="Gira a l'esquerra"
          onClick={() => onRotate(-1)}
          disabled={!floor}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d={ROTATE_ICON_PATH} />
          </svg>
        </ButtonIcon>
        <ButtonIcon
          className="fe-icon-btn"
          title="Gira a la dreta"
          aria-label="Gira a la dreta"
          onClick={() => onRotate(1)}
          disabled={!floor}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <g transform="translate(24 0) scale(-1 1)">
              <path d={ROTATE_ICON_PATH} />
            </g>
          </svg>
        </ButtonIcon>
```

- [ ] **Step 3: Wire `onRotate` from the editor panel**

In `src/panels/FloorEditorPanel.tsx`, the `<FloorToolbar … />` (lines ~44-55) gets a new prop:
```tsx
            onRotate={fp.rotateFloor}
```
(`fp` is the `useFloorPlan()` result; `rotateFloor` was added in Task 3.)

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors.

- [ ] **Step 5: Manual check**

Run: `npm run dev`. Open the Floor editor. The toolbar shows two rotate buttons. Drawing a non-square room and clicking rotate changes `dir`; undo/redo includes the rotation; the editor canvas itself does NOT rotate (it shows the 50×50 grid), but Save persists `dir`.
Expected: buttons work, undo/redo includes rotation, Save enabled (dirty) after rotating.

- [ ] **Step 6: Commit**

```bash
git add src/components/floor/FloorToolbar.tsx src/panels/FloorEditorPanel.tsx src/components/floor/rotate-icon-path.ts
git commit -m "feat(floor-editor): rotation buttons in toolbar via rotateFloor"
```

---

### Task 6: FloorPanel reads `activeFloor.dir`; remove local rotation; pass `dir` to views

**Files:**
- Modify: `src/panels/FloorPanel.tsx`
- Modify: `src/index.css` (remove now-orphaned `.fv-rotate` if unused)

**Interfaces:**
- Consumes: `FloorView` `dir` prop (Task 4); `FloorView3D` `dir` prop (already exists); `activeFloor.dir` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Remove local rotation state and buttons; read `activeFloor.dir`**

In `src/panels/FloorPanel.tsx`:
- Remove `const [dir, setDir] = useState<Dir>(0)` (line ~67) and the now-unused `import type { Dir }` if it becomes unused (keep if still referenced).
- Remove `ROTATE_ICON_PATH` constant and the `ButtonIcon` import if no longer used in this file.
- Remove the entire `<div className="fv-rotate"> … </div>` block (the two rotation buttons).
- Compute the active floor's dir: `const dir = activeFloor.dir` (use it where `dir` was used). `activeFloor` is already derived in this component (it's used by `FloorView3D`).
- Pass `dir` to BOTH views:
  - `<FloorView3D … dir={dir} … />` (already passes `dir`; now it comes from `activeFloor.dir` instead of local state).
  - `<FloorView … dir={dir} … />` (newly add the prop to the 2D render).

Read the file first to see the exact 2D vs 3D render branch (around line 224 `{view === '3d' ? <FloorView3D …/> : <FloorView …/>}`). Ensure the 2D branch now passes `dir={dir}`.

- [ ] **Step 2: Tighten FloorView's `dir` prop back to required (optional cleanup)**

Now that FloorPanel passes `dir`, you MAY revert the `dir?:` default added in Task 4 Step 3 back to required `dir: Dir`. Do this in `src/components/floor/FloorView.tsx`:
```ts
interface FloorViewProps {
  floor: Floor
  dir: Dir
  …
}
export function FloorView({ floor, dir, agentsById, onSelectAgent, showAvatars, animations }: FloorViewProps) {
```
(If any other caller exists that doesn't pass `dir`, keep it optional. Search: `grep -rn "<FloorView\b" src/`.)

- [ ] **Step 3: Remove orphaned `.fv-rotate` CSS**

Run `grep -rn "fv-rotate" src/`. If it now appears only in `src/index.css` (its own rule), delete the `.fv-rotate` rule. If still referenced anywhere, leave it.

- [ ] **Step 4: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors (watch for unused `useState`/`Dir`/`ButtonIcon` imports — remove any the linter flags).

- [ ] **Step 5: Manual check (the whole feature)**

Run: `npm run dev`.
- Editor: draw a non-square room, rotate left/right → room orientation changes; undo/redo works; Save.
- Floor (2D): the saved rotation is reflected; the room is framed to its rotated bbox and scaled to fill; no rotate buttons present.
- Floor (3D): toggle to 3D — same `dir` applies; the SVG scales to fill (verified/added in Task 7 if needed).
- Home: shows the same rotated, scaled floor (it renders `<FloorPanel />`).
- Switch floors: each floor keeps its own `dir`.

- [ ] **Step 6: Commit**

```bash
git add src/panels/FloorPanel.tsx src/components/floor/FloorView.tsx src/index.css
git commit -m "feat(floor): viewer reads per-floor dir; rotation buttons removed from Floor"
```

---

### Task 7: 3D view scales to fill the container

**Files:**
- Modify: `src/components/floor/FloorView3D.tsx` (the `<svg className="fv3d-svg">`, lines ~360-366)
- Modify: `src/index.css` (`.fv3d-svg` rule)

**Interfaces:**
- Consumes: nothing new (3D already rotates via `dir` from FloorPanel, Task 6).
- Produces: nothing new.

- [ ] **Step 1: Make the SVG scale to its container**

The SVG already has a correct `viewBox` (FloorView3D.tsx:364). To scale it to the container while preserving aspect ratio, make `width`/`height` fluid and add `preserveAspectRatio`. Change the `<svg>` opening tag (lines ~360-366) to:
```tsx
    <svg
      className="fv3d-svg"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
```
(Remove the fixed `width={bounds.width}` / `height={bounds.height}` attributes — sizing now comes from CSS + viewBox.)

- [ ] **Step 2: Add CSS to size the SVG to the container**

In `src/index.css`, find `.fv3d-svg`. Ensure it fills its container:
```css
.fv3d-svg {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: block;
}
```
(Merge with any existing `.fv3d-svg` declarations rather than duplicating; keep existing non-conflicting properties.)

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`. Open Floor in 3D. The isometric room should scale to fill the panel (grow to fill, not fixed-size), rotate with the editor's `dir`, and re-fit when you rotate (bbox changes orientation).
Expected: 3D fills the container at any `dir`; nothing clipped; rotation reflected.

- [ ] **Step 5: Commit**

```bash
git add src/components/floor/FloorView3D.tsx src/index.css
git commit -m "feat(floor): 3D view scales to fill container"
```

---

## Self-Review

**Spec coverage:**
- Per-floor `dir` saved in plan → Task 1 (field) + Task 3 (mutation) + Task 6 (read). ✓
- Grid 50×50, discard old data → Task 1. ✓
- Pure rotation helpers → Task 2. ✓
- Rotation editable only in editor; buttons moved → Task 5 (add to editor) + Task 6 (remove from Floor). ✓
- 2D rotates + frames rotated bbox + scales to container → Task 4. ✓
- 3D respects shared `dir` + scales to container → Task 6 (dir wiring) + Task 7 (scaling). ✓
- Home inherits via `<FloorPanel/>` → no task needed (verified HomePanel.tsx:115). ✓
- lint 0 errors / build green gates → every task ends with `npm run build && npm run lint`. ✓

**Placeholder scan:** Task 1 Step 3 ("find every other place that constructs a Floor literal") is reasoning-not-verbatim because the literals depend on the current file — but the mechanical rule (add `dir: 0`; `tsc` names each one) is explicit. Task 2 Step 4 is a throwaway check with full code. No TODO/TBD left.

**Type consistency:** `rotateCell(c,r,dir,n)`, `rotateEdge(edge,dir)`, `roomBounds2D(cells,dir,n)` defined in Task 2 and consumed verbatim in Task 4. `rotateFloor(delta: 1 | -1)` defined in Task 3, consumed in Task 5 (`onRotate={fp.rotateFloor}`). `Floor.dir: Dir` from Task 1 used in Tasks 3/4/6. `Dir` moved to `types.ts` and re-exported from `floor-iso.ts` (Task 1 Step 1) — all imports resolve. `FloorView` `dir` prop: optional default in Task 4, tightened in Task 6 — consistent.

**Coupling note for the executor:** Tasks 4 and 6 are coupled on the `FloorView` `dir` prop. Task 4 keeps the build green via an optional `dir?` default; Task 6 passes the real value and tightens it. This is called out in Task 4 Step 3 and Task 6 Step 2.
