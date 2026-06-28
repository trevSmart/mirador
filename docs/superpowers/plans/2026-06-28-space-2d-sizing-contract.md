# Space 2D Sizing Contract Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 2D space renderer (`SpaceView`) follow the same sizing contract as the 3D renderer (`SpaceView3D`) — fill the tile width and derive its height from the room's intrinsic aspect-ratio — eliminating the empty vertical gap below each floor and the squashing/cropping at small zoom.

**Architecture:** Today the 2D renderer carries its own bespoke sizing pipeline (a `ResizeObserver` computing a fit-to-width `scale`, plus the `--fv-grid-w` / `--fv-grid-h` / `--fv-fit-scale` custom properties consumed by `.fv-grid-zoom`) **and** re-multiplies the user zoom (`--fv-render-zoom`) on top. The 3D renderer instead lets CSS do all sizing: a single `<svg>` with `width:100%; height:auto; aspect-ratio: <room ratio>`. The user zoom is already expressed once, as the tile width (`flex-basis: 280px * zoom` in multi-space, `width: 100% * zoom` in single-space). This plan removes the 2D-only pipeline and makes `.fv-grid` size itself purely from `aspect-ratio`, exactly mirroring `.fv3d-svg`. The `ResizeObserver`, the inline `--fv-grid-w/h` and `--fv-fit-scale`, and the `.fv-grid-zoom` wrapper are deleted; `.fv-grid` scales its absolutely-positioned cells via a CSS `transform: scale()` driven by the container's measured width over the intrinsic grid width — but that measurement now comes from a CSS `aspect-ratio` box, not JS.

**Tech Stack:** React 18 + TypeScript, plain CSS (custom properties + `aspect-ratio`), Vitest + Testing Library, chrome-devtools MCP for visual verification.

## Global Constraints

- Lint and test are the green gates; `npm run build` is known-broken on HEAD for unrelated reasons (DockviewShell/DevConsole) — do **not** treat a build failure in those files as a regression. (See memory: build-broken-on-head.)
- All user-facing copy stays in Català. No copy changes are introduced by this plan.
- Cell unit `VIEW_CELL = 46` stays the canonical 2D cell size; do not change it.
- The user zoom range is `0.5`–`3` (`SPACE_ZOOM_MIN`/`MAX` in `src/components/space/space-zoom.ts`); zoom must keep working in both single-space (scroll) and multi-space (tile resize) modes after the refactor.
- The 3D renderer (`SpaceView3D.tsx`, `.fv3d-*` CSS) is the reference contract and MUST NOT be modified.
- Measured reference (zoom 194%, multi-space, viewport 1512w): in 3D every floor has `gapBelowRender = 0` (tile height == render height == svg height). In broken 2D, Planta Vendes renders a `543×194` grid inside a `543×377` `.fv-grid-zoom`, leaving ~183px of empty space. The fix must bring 2D to `gapBelowRender = 0` like 3D.

---

## File Structure

- `src/components/space/SpaceView.tsx` — **modify**. Remove the `ResizeObserver`, the `scale` state, the `--fv-grid-w/h` inline vars and the `.fv-grid-zoom` wrapper element. Emit an intrinsic `aspect-ratio` on the sizing box and let CSS fill width + derive height. Keep all cell/seat/divider/opening rendering and the `VIEW_CELL`-based absolute layout untouched.
- `src/index.css` — **modify**. Replace the `.fv-grid-zoom` rule (which multiplies `--fv-grid-w/h` by `--fv-render-zoom`) and rework `.fv-fit` / `.fv-grid` so the 2D box sizes via `aspect-ratio: var(--fv-aspect)` and `width:100%`, mirroring `.fv3d-svg`. Remove now-dead consumers of `--fv-grid-w`, `--fv-grid-h`, `--fv-fit-scale`.
- `src/components/space/SpaceView.test.tsx` — **create** (no existing test file for this component). Unit-test the intrinsic aspect-ratio computation extracted as a pure helper, and assert the rendered sizing box carries the expected `aspect-ratio` style and no longer renders `.fv-grid-zoom`.
- `src/components/space/space-view-aspect.ts` — **create**. A tiny pure helper `roomAspect(cols, rows)` returning the intrinsic width/height ratio string for CSS `aspect-ratio`, so the math is unit-testable without rendering. (Keeps `SpaceView.tsx` focused and DRY.)

---

### Task 1: Extract the intrinsic aspect-ratio helper

The 2D room's intrinsic shape is `cols × VIEW_CELL` wide by `rows × VIEW_CELL` tall. Since `VIEW_CELL` is a common factor, the ratio is simply `cols / rows`. We express it as a CSS `aspect-ratio` string (`"cols / rows"`) so the browser derives height from width with sub-pixel accuracy — exactly how `.fv3d-svg` uses its viewBox ratio.

**Files:**
- Create: `src/components/space/space-view-aspect.ts`
- Test: `src/components/space/SpaceView.test.tsx`

**Interfaces:**
- Consumes: nothing (pure function).
- Produces: `export function roomAspect(cols: number, rows: number): string` — returns a CSS `aspect-ratio` value string `"<cols> / <rows>"`. Guards against zero/negative by clamping each dimension to a minimum of `1` (mirrors `roomBounds2D`'s empty-room fallback of `cols:1, rows:1`).

- [ ] **Step 1: Write the failing test**

Create `src/components/space/SpaceView.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest'
import { roomAspect } from './space-view-aspect'

describe('roomAspect', () => {
  it('returns the cols/rows ratio as a CSS aspect-ratio string', () => {
    expect(roomAspect(14, 5)).toBe('14 / 5')
  })

  it('reduces nothing — raw cols/rows is enough for CSS', () => {
    expect(roomAspect(10, 4)).toBe('10 / 4')
  })

  it('clamps non-positive dimensions to 1 to avoid an invalid ratio', () => {
    expect(roomAspect(0, 0)).toBe('1 / 1')
    expect(roomAspect(-3, 2)).toBe('1 / 2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/space/SpaceView.test.tsx`
Expected: FAIL — `Failed to resolve import "./space-view-aspect"` / `roomAspect is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/space/space-view-aspect.ts`:

```ts
/**
 * Intrinsic CSS aspect-ratio of a 2D room. The grid is `cols × VIEW_CELL` wide
 * by `rows × VIEW_CELL` tall; the shared VIEW_CELL factor cancels, so the ratio
 * is just cols/rows. Returned as a CSS `aspect-ratio` string so the browser
 * derives height from the filled width — mirroring how `.fv3d-svg` sizes from
 * its viewBox ratio.
 */
export function roomAspect(cols: number, rows: number): string {
  const w = cols > 0 ? cols : 1
  const h = rows > 0 ? rows : 1
  return `${w} / ${h}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/space/SpaceView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/space/space-view-aspect.ts src/components/space/SpaceView.test.tsx
git commit -m "feat: add roomAspect helper for 2D space sizing contract"
```

---

### Task 2: Rewrite SpaceView to size via aspect-ratio (drop ResizeObserver + grid-zoom)

Replace the bespoke fit-to-width pipeline with the 3D contract. The component keeps computing `bounds` (`cols`/`rows`/`minC`/`minR`) and renders the exact same cells/seats/dividers/openings at `VIEW_CELL` units — but the outer box now declares `aspect-ratio` and fills width via CSS, and the inner `.fv-grid` scales to fit using a CSS `transform` derived from container-width ÷ intrinsic-width measured by a `ResizeObserver` that **only** reads width (no height math, no `--fv-render-zoom` re-multiplication).

> Why keep a ResizeObserver at all? `.fv-cell` children are absolutely positioned at raw `VIEW_CELL` pixels, so `.fv-grid` has an intrinsic pixel size (`gridW × gridH`) that must be scaled down to the rendered width. The container's rendered width now comes from the `aspect-ratio` box (CSS-driven, correct in both modes), and we scale `.fv-grid` by `renderedWidth / gridW`. Height follows automatically because the box's height is `width / aspect = gridH/gridW * width = gridH * scale`. No separate height var, no double zoom.

**Files:**
- Modify: `src/components/space/SpaceView.tsx` (the `SpaceView` function body and its returned JSX; `SpaceSeat` and imports stay except where noted)
- Modify (continue): `src/components/space/SpaceView.test.tsx`

**Interfaces:**
- Consumes: `roomAspect(cols, rows)` from Task 1; `roomBounds2D` (returns `{ minC, minR, cols, rows }`), `VIEW_CELL = 46`.
- Produces: a `SpaceView` whose DOM is `.fv-fit > .fv-grid` (the `.fv-grid-zoom` wrapper is removed). `.fv-fit` carries `style={{ ['--fv-aspect']: roomAspect(cols, rows) }}`. `.fv-grid` carries `style={{ width: gridW, height: gridH, ['--fv-fit-scale']: scale }}` where `scale = measuredWidth / gridW`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/space/SpaceView.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { SpaceView } from './SpaceView'
import type { Space } from '../../space/types'

function makeSpace(): Space {
  // 3 cols × 2 rows room, one seat, no dividers/openings.
  return {
    id: 's1',
    name: 'Test',
    dir: 0,
    cells: [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
    ],
    seats: [{ c: 0, r: 0, agentId: null }],
    dividers: [],
    openings: [],
  } as unknown as Space
}

describe('SpaceView sizing contract', () => {
  it('declares the intrinsic aspect-ratio on the fit box and renders no grid-zoom wrapper', () => {
    const { container } = render(
      <SpaceView
        space={makeSpace()}
        dir={0}
        agentsById={new Map()}
        showAvatars={false}
        animations={false}
        onSelectAgent={() => {}}
      />,
    )
    const fit = container.querySelector('.fv-fit') as HTMLElement
    expect(fit).not.toBeNull()
    // 3 cols × 2 rows → "3 / 2"
    expect(fit.style.getPropertyValue('--fv-aspect')).toBe('3 / 2')
    // The old double-zoom wrapper is gone.
    expect(container.querySelector('.fv-grid-zoom')).toBeNull()
    // The grid still carries its raw intrinsic pixel size.
    const grid = container.querySelector('.fv-grid') as HTMLElement
    expect(grid.style.width).toBe('138px') // 3 * 46
    expect(grid.style.height).toBe('92px') // 2 * 46
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/space/SpaceView.test.tsx`
Expected: FAIL — the `--fv-aspect` assertion fails (currently no such property) and/or `.fv-grid-zoom` is still present.

- [ ] **Step 3: Rewrite the SpaceView render body**

In `src/components/space/SpaceView.tsx`:

1. Add the import near the other local imports:

```tsx
import { roomAspect } from './space-view-aspect'
```

2. Replace the sizing logic. The current code (lines ~91–128) computes `scale` from `gridW` and emits `--fv-grid-w/h` on `.fv-grid-zoom`. Replace the `containerRef`/`scale`/`useEffect` block + the returned `.fv-fit > .fv-grid-zoom > .fv-grid` JSX with:

```tsx
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const gridW = cols * VIEW_CELL
  const gridH = rows * VIEW_CELL

  // The .fv-fit box fills the tile width and derives its height from the
  // intrinsic aspect-ratio (set via --fv-aspect below), exactly like .fv3d-svg.
  // We only need the rendered width to scale the raw-pixel .fv-grid down to fit.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const cw = entry.contentRect.width
      if (!gridW || !isFinite(cw) || cw === 0) return
      const next = cw / gridW
      if (!isFinite(next) || next === 0) return
      setScale((prev) => (prev === next ? prev : next))
    })
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [gridW])

  return (
    <div
      className="fv-fit"
      ref={containerRef}
      style={{ ['--fv-aspect' as string]: roomAspect(cols, rows) }}
    >
      <div
        className="fv-grid"
        style={{
          width: gridW,
          height: gridH,
          ['--fv-fit-scale' as string]: scale,
        }}
      >
        {rotated.cells.map(([c, r]) => {
          const seat = rotated.seatByKey.get(cellKey(c, r))
          const agent = seat?.agentId ? agentsById.get(seat.agentId) ?? null : null
          return (
            <div
              key={cellKey(c, r)}
              className={`fv-cell${(c + r) % 2 === 0 ? '' : ' fv-cell--alt'}`}
              style={{
                left: (c - minC) * VIEW_CELL,
                top: (r - minR) * VIEW_CELL,
                width: VIEW_CELL,
                height: VIEW_CELL,
              }}
            >
              {seat ? (
                agent ? (
                  <SpaceSeat
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
```

This removes the `.fv-grid-zoom` element and the `--fv-grid-w`/`--fv-grid-h` inline vars entirely. `.fv-grid` keeps `--fv-fit-scale` (used by the existing `.fv-grid` `transform: scale()` rule).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/space/SpaceView.test.tsx`
Expected: PASS (all tests, including Task 1's).

- [ ] **Step 5: Commit**

```bash
git add src/components/space/SpaceView.tsx src/components/space/SpaceView.test.tsx
git commit -m "refactor: size 2D space via aspect-ratio, drop grid-zoom double-zoom"
```

---

### Task 3: Rework the CSS sizing rules to the aspect-ratio contract

Replace the `.fv-grid-zoom` rule (the source of the double-zoom) and adjust `.fv-fit` so the 2D box mirrors `.fv3d-svg`: fill width, derive height from `aspect-ratio`. The `.fv-grid` `transform: scale(var(--fv-fit-scale))` rule stays — it shrinks the raw-pixel grid to the filled width, and because the box height is `width / aspect`, the scaled grid lands exactly with no leftover.

**Files:**
- Modify: `src/index.css` (`.fv-fit` at ~3077–3080, `.fv-grid-zoom` at ~3082–3089, and the reduced-motion block listing `.fv-grid-zoom` at ~3066–3074)

**Interfaces:**
- Consumes: `--fv-aspect` (set by `SpaceView` on `.fv-fit`), `--fv-fit-scale` (set on `.fv-grid`).
- Produces: a `.fv-fit` that sizes itself; `.fv-grid-zoom` no longer exists in CSS.

- [ ] **Step 1: Replace the `.fv-fit` and `.fv-grid-zoom` rules**

Find (around `src/index.css:3077`):

```css
.fv-fit {
  width: 100%;
  overflow: hidden;
}

.fv-grid-zoom {
  width: calc(var(--fv-grid-w, 100%) * var(--fv-render-zoom, 1));
  height: calc(var(--fv-grid-h, auto) * var(--fv-render-zoom, 1));
  overflow: hidden;
  transition:
    width 0.35s var(--ease),
    height 0.35s var(--ease);
}
```

Replace with:

```css
/* 2D sizing contract — mirrors .fv3d-svg: fill the tile width, derive height
   from the room's intrinsic aspect-ratio. The user zoom is already expressed
   once as the tile width (flex-basis in multi-space, width*zoom in single),
   so it must NOT be re-applied here. */
.fv-fit {
  width: 100%;
  aspect-ratio: var(--fv-aspect, 1 / 1);
  overflow: hidden;
}
```

- [ ] **Step 2: Remove `.fv-grid-zoom` from the reduced-motion list**

Find (around `src/index.css:3066`):

```css
  .fv-stack,
  .fv-stack__item,
  .fv-stack__render,
  .fv-grid-zoom,
  .fv3d-svg {
    transition: none !important;
  }
```

Replace with (drop the now-deleted selector):

```css
  .fv-stack,
  .fv-stack__item,
  .fv-stack__render,
  .fv3d-svg {
    transition: none !important;
  }
```

- [ ] **Step 3: Confirm no other `--fv-grid-w` / `--fv-grid-h` / `.fv-grid-zoom` consumers remain**

Run: `grep -rn "fv-grid-zoom\|--fv-grid-w\|--fv-grid-h" src`
Expected: **no matches** (all consumers removed across Tasks 2–3). If any match remains, it is dead code from this pipeline — remove it.

- [ ] **Step 4: Run lint + unit tests**

Run: `npm run lint && npx vitest run src/components/space/SpaceView.test.tsx`
Expected: lint clean; SpaceView tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "refactor: 2D space CSS sizes via aspect-ratio, remove grid-zoom rule"
```

---

### Task 4: Verify the single-space zoom path still scrolls

In single-space mode the tile is `flex: 1 1 auto` (fills the canvas) and the zoom must produce real scroll (the 3D equivalent is `.fv-stack--single .fv3d-svg { width: calc(100% * var(--fv-render-zoom, 1)) }`). After Task 3, the 2D `.fv-fit` is `width: 100%` of its tile — so at zoom > 1 it would NOT grow/scroll, unlike 3D. This task adds the single-space zoom rule for 2D so both renderers behave identically.

**Files:**
- Modify: `src/index.css` (add a `.fv-stack--single .fv-fit` rule next to the existing `.fv-stack--single .fv3d-svg` at ~3344)

**Interfaces:**
- Consumes: `--fv-render-zoom` (inherited from `.fv-stack`), `--fv-aspect` (on `.fv-fit`).
- Produces: single-space 2D that grows with zoom and scrolls inside `.fv-canvas` (`overflow:auto`), matching single-space 3D.

- [ ] **Step 1: Add the single-space 2D zoom rule**

Find the existing single-space 3D rule (around `src/index.css:3343`):

```css
/* Single-space mode: the tile fills the canvas at a fixed size, so the SVG
   itself carries the zoom and the canvas scrolls to reveal the larger space. */
.fv-stack--single .fv3d-svg {
  width: calc(100% * var(--fv-render-zoom, 1));
}
```

Add immediately after it:

```css
/* Same contract for 2D: in single-space the .fv-fit box carries the zoom so
   the canvas scrolls. Height still follows --fv-aspect, so it never squashes. */
.fv-stack--single .fv-fit {
  width: calc(100% * var(--fv-render-zoom, 1));
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: 2D single-space zoom scrolls like 3D via --fv-render-zoom on fit box"
```

---

### Task 5: Visual verification in the running app

Confirm the fix end-to-end: the empty gap is gone in multi-space 2D at default and high zoom, and the room is no longer squashed/cropped at low zoom — matching 3D's `gapBelowRender = 0`.

**Files:** none (verification only).

**Interfaces:** Consumes the running dev server at `http://localhost:3000` and the chrome-devtools MCP.

- [ ] **Step 1: Open the Space panel in 2D**

Navigate to `http://localhost:3000`, open the **Space** panel (Afegir panell → Space), click the **2D** toggle.

- [ ] **Step 2: Measure the gap at default-ish zoom (multi-space)**

Evaluate in the page:

```js
() => {
  const round = (n) => Math.round(n);
  return [...document.querySelectorAll('.fv-stack__item')].map((item) => {
    const label = item.querySelector('.fv-stack__label')?.textContent ?? '(single)';
    const render = item.querySelector('.fv-stack__render');
    const fit = item.querySelector('.fv-fit');
    const itemR = item.getBoundingClientRect();
    const renderBottom = render ? render.getBoundingClientRect().bottom : itemR.top;
    return {
      label,
      gapBelowRender: round(itemR.height - (renderBottom - itemR.top)),
      fitAspect: fit ? getComputedStyle(fit).aspectRatio : null,
      hasGridZoom: !!item.querySelector('.fv-grid-zoom'),
    };
  });
}
```

Expected: every floor has `gapBelowRender` ≈ `0` (≤ 2px rounding), `hasGridZoom: false`, and `fitAspect` is a real ratio (not `auto`).

- [ ] **Step 3: Check low zoom (no squash/crop)**

Set zoom to ~54% via the Zoom control (or Ctrl/⌘+wheel out), then re-run the Step 2 snippet. Expected: `gapBelowRender` still ≈ 0 and the room is not cropped — take a screenshot and confirm the full room (all rows) is visible, scaled down, not clipped.

- [ ] **Step 4: Confirm 3D is unchanged**

Toggle to 3D, re-run the Step 2 snippet. Expected: identical `gapBelowRender ≈ 0` as before the refactor (3D was never touched).

- [ ] **Step 5: Final regression gate**

Run: `npm run lint && npx vitest run`
Expected: lint clean; full test suite green (no regressions in other space tests).

This task has no commit — it gates the branch as verified.

---

## Self-Review Notes

- **Spec coverage:** empty gap (Tasks 2–3), low-zoom squash/crop (Tasks 2–3 via aspect-ratio + Task 5 verification), single-space zoom parity (Task 4), 3D untouched (constraint + Task 5 Step 4). ✓
- **Double-zoom root cause** removed by deleting `--fv-grid-w/h * --fv-render-zoom` (Task 3) and not re-applying zoom in `SpaceView` (Task 2). ✓
- **Type/name consistency:** `roomAspect(cols, rows): string`, `--fv-aspect`, `--fv-fit-scale` used identically across Tasks 1–4. `.fv-grid-zoom` removed in both TSX (Task 2) and CSS (Task 3), with a grep gate (Task 3 Step 3). ✓
- **No placeholders:** every code step shows full code; commands have expected output. ✓
