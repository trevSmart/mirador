# Plan Tree 3D Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static plant icon in `SpacePlanTree` with a lazily-mounted, non-interactive `SpaceView3D` thumbnail that draws agents as ground-level avatars without towers.

**Architecture:** Add two opt-in props (`towers`, `interactive`) to the shared `SpaceView3D` whose defaults keep every current usage unchanged. Wrap the render in a new `SpacePlanThumb` that mounts it only when scrolled into view. Feed `agentsById`/`queuesById` from `SpaceEditorPanel` down through `SpacePlanTree`.

**Tech Stack:** React, TypeScript, SVG, IntersectionObserver, Vitest.

## Global Constraints

- Existing `SpaceView3D` usages (`SpacePanel`, `SpaceEditorPanel` preview) must render identically — new props default to the current behaviour (`towers=true`, `interactive=true`).
- Gates: `npx tsc --noEmit` and `npx eslint <changed files>` must pass. Build is known-broken pre-existing; do not rely on it.
- UI copy in Català.

---

### Task 1: Add `towers` and `interactive` props to `SpaceView3D`

**Files:**
- Modify: `src/components/space/SpaceView3D.tsx`

**Interfaces:**
- Produces: `SpaceView3DProps` gains `towers?: boolean` (default `true`) and `interactive?: boolean` (default `true`). `IsoSeat` gains `towers: boolean`. Avatar ground position when `towers=false` is `cy={y}` (vs `cy={y - h - VEC_TH * 0.62}` when true).

- [ ] **Step 1: Extend the props interface and signature**

In `SpaceView3DProps` (around line 478) add the two optional props:

```tsx
interface SpaceView3DProps {
  space: Space
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  showAvatars: boolean
  animations: boolean
  onSelectAgent: (agent: Agent) => void
  /** Draw agent towers (default). When false, only the ground avatar shows. */
  towers?: boolean
  /** Orbit/drag, tooltips, hover overlay and rotation persistence (default).
      When false the render is a static, non-interactive thumbnail. */
  interactive?: boolean
}
```

Update the destructuring (around line 487) to default them:

```tsx
export function SpaceView3D({ space, agentsById, queuesById, showAvatars, animations, onSelectAgent, towers = true, interactive = true }: SpaceView3DProps) {
```

- [ ] **Step 2: Thread `towers` into `IsoSeat` and add the no-tower branch**

Add `towers: boolean` to `IsoSeatProps` (around line 393) and to the destructured params of `IsoSeat` (around line 408).

Replace the `IsoSeat` body block (the `const body = (...)` around lines 423-432) with a tower-aware version. When `towers` is false: skip the tower group, anchor the avatar at the ground (`y`), and reposition glow/beacon to the ground:

```tsx
  const avatarCy = towers ? y - h - VEC_TH * 0.62 : y

  const glow =
    ratio > 0.04 ? (
      <ellipse key="glow" cx={x} cy={y} rx={VEC_TW * 0.92} ry={VEC_TH * 0.92} style={{ fill: topColor }} opacity={0.16 + ratio * 0.34} filter={`url(#${clipPrefix}-glow)`} />
    ) : null

  const body = (
    <>
      {glow}
      {towers ? <g key="tower">{segmentedTowerFaces(x, y, b, h, segments, idBase)}</g> : null}
      <g className={`fv3d-avatar${showAvatars ? ' fv3d-avatar--on' : ''}`}>
        <AvatarDisc key="avatar" agent={agent} cx={x} cy={avatarCy} r={VEC_TH * 1.05} ring={AVATAR_RING} showPhoto clipPrefix={clipPrefix} />
      </g>
      {saturated ? <SaturationBeacon x={x} avatarCy={avatarCy} animations={animations} /> : null}
    </>
  )
```

(`glow` keeps its existing definition; it is shown here only for surrounding context — do not duplicate it.)

- [ ] **Step 3: Pass `towers` where `IsoSeat` is rendered**

In the cell loop where `IsoSeat` is created (around line 727) add the prop:

```tsx
          <IsoSeat key={`s-${key}`} agent={agent} x={x} y={y} b={basis} showAvatars={showAvatars} animations={animations} towers={towers} queuesById={queuesById} onSelect={onSelectAgent} onPointerOver={handleSeatOver} onPointerMove={handleSeatMove} onPointerOut={handleSeatOut} clipPrefix={svgIdPrefix} />
```

- [ ] **Step 4: Gate interactivity behind `interactive`**

Persistence — guard the save effect (around line 516) so a thumbnail never writes:

```tsx
  useEffect(() => {
    if (!interactive) return
    if (!dirtyRef.current) return
    const id = window.setTimeout(() => saveRoomRotation(space.id, rotation), 250)
    return () => window.clearTimeout(id)
  }, [interactive, space.id, rotation])
```

Pointer handlers — on the `fv3d-wrap` div (around line 742) make orbit handlers conditional and drop the grab cursor:

```tsx
      <div
        className="fv3d-wrap"
        onPointerLeave={interactive ? handleSeatOut : undefined}
        onPointerDown={interactive ? onDown : undefined}
        onPointerMove={interactive ? onMove : undefined}
        onPointerUp={interactive ? onUp : undefined}
        onPointerCancel={interactive ? onUp : undefined}
        style={{ cursor: interactive ? (dragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      >
```

Hover overlay — gate the hovered-avatar overlay (around line 792) so it never shows in a thumbnail:

```tsx
          {interactive && showAvatars && hoveredAgent && hoverPos ? (
            <HoverAvatar key={hoveredAgent.id} agent={hoveredAgent} x={hoverPos[0]} y={hoverPos[1]} animations={animations} clipPrefix={`${svgIdPrefix}-hover`} />
          ) : null}
```

Tooltip — gate the portal (around line 799) so no tooltip renders:

```tsx
      {interactive && tooltip
        ? createPortal(
            <SpaceSeatTooltip agent={tooltip.agent} queuesById={queuesById} x={tooltip.x} y={tooltip.y} open={tooltipOpen} onExited={handleTooltipExited} />,
            document.body,
          )
        : null}
```

- [ ] **Step 5: Verify gates pass**

Run: `npx tsc --noEmit && npx eslint src/components/space/SpaceView3D.tsx`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/components/space/SpaceView3D.tsx
git commit -m "feat: add towers/interactive opt-out props to SpaceView3D

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `SpacePlanThumb` — lazy, viewport-gated thumbnail

**Files:**
- Create: `src/components/space/SpacePlanThumb.tsx`

**Interfaces:**
- Consumes: `SpaceView3D` from Task 1 (props `towers`, `interactive`).
- Produces: `SpacePlanThumb({ space, agentsById, queuesById })` — a `<div className="fe-plan-tree__thumb">` that mounts `SpaceView3D` only once visible.

- [ ] **Step 1: Write the component**

```tsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Space } from '../../space/types'

const SpaceView3D = lazy(() =>
  import('./SpaceView3D').then((m) => ({ default: m.SpaceView3D })),
)

const noop = () => {}

interface SpacePlanThumbProps {
  space: Space
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

/* A static, non-interactive miniature of a space's 3D render, used as the
   per-plant node visual in SpacePlanTree. The heavy SpaceView3D is mounted only
   once the node scrolls into view, so a long list never pays for off-screen
   renders. Agents show as ground-level avatars (towers={false}). */
export function SpacePlanThumb({ space, agentsById, queuesById }: SpacePlanThumbProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <div className="fe-plan-tree__thumb" ref={ref} aria-hidden="true">
      {visible ? (
        <Suspense fallback={null}>
          <SpaceView3D
            space={space}
            agentsById={agentsById}
            queuesById={queuesById}
            showAvatars
            animations={false}
            towers={false}
            interactive={false}
            onSelectAgent={noop}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify gates pass**

Run: `npx tsc --noEmit && npx eslint src/components/space/SpacePlanThumb.tsx`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/space/SpacePlanThumb.tsx
git commit -m "feat: add SpacePlanThumb viewport-gated 3D miniature

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the thumbnail into `SpacePlanTree`

**Files:**
- Modify: `src/components/space/SpacePlanTree.tsx`

**Interfaces:**
- Consumes: `SpacePlanThumb` from Task 2.
- Produces: `SpacePlanTreeProps` gains `agentsById: Map<string, Agent>` and `queuesById: Map<string, Queue>`. The `name="space"` `SfIcon` per plant is replaced by `SpacePlanThumb`.

- [ ] **Step 1: Update imports and props**

Replace the top of `SpacePlanTree.tsx` import/interface block:

```tsx
import { useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Place } from '../../space/types'
import { SfIcon } from '../ds/SfIcon'
import { SpacePlanThumb } from './SpacePlanThumb'

interface SpacePlanTreeProps {
  places: Place[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}
```

Update the function signature:

```tsx
export function SpacePlanTree({ places, agentsById, queuesById }: SpacePlanTreeProps) {
```

- [ ] **Step 2: Replace the plant icon with the thumbnail**

In the `place.spaces.map(...)` block, replace the `<SfIcon name="space" sldsSize="x-small" />` line with:

```tsx
                      <SpacePlanThumb space={space} agentsById={agentsById} queuesById={queuesById} />
```

The place row's `<SfIcon sprite="standard" symbol="address" sldsSize="x-small" />` stays unchanged.

- [ ] **Step 3: Verify gates pass**

Run: `npx tsc --noEmit && npx eslint src/components/space/SpacePlanTree.tsx`
Expected: `tsc` reports the missing props at the `SpaceEditorPanel` call site (fixed in Task 4); eslint clean. If `tsc` shows only the `SpaceEditorPanel.tsx` error, proceed — Task 4 resolves it.

- [ ] **Step 4: Commit**

```bash
git add src/components/space/SpacePlanTree.tsx
git commit -m "feat: render 3D thumbnail per plant in SpacePlanTree

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Pass agent/queue maps from `SpaceEditorPanel`

**Files:**
- Modify: `src/panels/SpaceEditorPanel.tsx`

**Interfaces:**
- Consumes: `SpacePlanTree` props from Task 3 (`agentsById`, `queuesById`).

- [ ] **Step 1: Pass the maps**

In the `<SpacePlanTree ... />` element (the one added below `<SpaceSidebar />`), add the two props. `agentsById` and `queuesById` already exist in this component (computed via `useMemo`):

```tsx
            <SpacePlanTree places={fp.places} agentsById={agentsById} queuesById={queuesById} />
```

- [ ] **Step 2: Verify gates pass**

Run: `npx tsc --noEmit && npx eslint src/panels/SpaceEditorPanel.tsx`
Expected: no output (clean) — the Task 3 call-site error is now resolved.

- [ ] **Step 3: Commit**

```bash
git add src/panels/SpaceEditorPanel.tsx
git commit -m "feat: feed agent/queue maps to SpacePlanTree

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Style the thumbnail node + spacing + connectors

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: the `.fe-plan-tree__thumb` class emitted by Task 2 and the existing `.fe-plan-tree__space` / connector rules.

- [ ] **Step 1: Add the thumbnail container rule**

Add, near the other `.fe-plan-tree__*` rules (after `.fe-plan-tree__space`):

```css
/* 3D miniature standing in for the old plant icon. Fixed height so the row
   height is predictable; the render fits inside and never captures pointers. */
.fe-plan-tree__thumb {
  flex: 0 0 auto;
  width: 132px;
  height: 96px;
  overflow: hidden;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.fe-plan-tree__thumb .fv3d-wrap {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

.fe-plan-tree__thumb .fv3d-svg {
  max-width: 100%;
  max-height: 100%;
}
```

- [ ] **Step 2: Give plant rows room for the render**

Change the `.fe-plan-tree__spaces` `gap` from `var(--sp-3)` to `var(--sp-6)` so the tall thumbnails do not crowd:

```css
.fe-plan-tree__spaces {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  padding-top: var(--sp-3);
  padding-left: var(--sp-10);
}
```

- [ ] **Step 3: Verify in the running app**

Run: `npx tsc --noEmit`
Expected: clean.

Then open the Space editor panel and confirm: each plant shows a small static 3D render with ground-level avatars (no towers), no orbit/tooltip on hover, the place still shows the green address pin, and connectors meet each thumbnail.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: style 3D thumbnail nodes and spacing in plan tree

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 `towers`/`interactive` props → Task 1. ✓
- §2 `SpacePlanThumb` lazy + IntersectionObserver → Task 2. ✓
- §3 `SpacePlanTree` props + thumbnail swap → Task 3. ✓
- §4 `SpaceEditorPanel` passes maps → Task 4. ✓
- §5 CSS spacing/thumb/connectors → Task 5. ✓

**Type consistency:** `towers`/`interactive` default `true` consistently in Task 1; `SpacePlanThumb` prop shape matches Task 2 creation and Task 3 consumption; `agentsById`/`queuesById` typed `Map<string, Agent>` / `Map<string, Queue>` throughout.

**Connectors note:** the existing `.fe-plan-tree__space::after` elbow meets the vertical centre of the row; since the thumbnail is the tallest child and is vertically centred (`align-items: center` on `.fe-plan-tree__space`), the elbow already lands at its centre. No extra connector rule needed.
