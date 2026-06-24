# Dropdown Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dropdown/popover in the app share one transition, border-radius, opacity and backdrop-filter (glass), driven by CSS tokens, and add a reusable scrim system.

**Architecture:** A single `.dropdown-panel` CSS class (already used by UserMenu and GlobalSearch) becomes the only source of truth for radius/background/blur/shadow/transition, all via new `--dropdown-*` tokens. Native `<select>` elements (Floor, Settings) are replaced by one shared custom `Select` combo box component in the design system that reuses `.dropdown-panel` + `syncDropdownPanel`. A standalone `.ui-scrim` class is added for future overlays.

**Tech Stack:** React 18 + TypeScript, plain CSS with custom properties (`src/index.css`), Vite. No test framework is currently present in this repo — verification is via TypeScript build (`tsc`/`vite build`) and manual browser checks. Each task therefore uses build-as-test plus an explicit manual verification step.

## Global Constraints

- Canonical dropdown values (from spec): radius `11px`, duration `.18s`, easing `var(--ease)`, blur `var(--blur-glass)` = `blur(10px)`, background = `--surface-card` at ~80% opacity via `color-mix`.
- `DROPDOWN_TRANSITION_MS` in `src/utils/sync-dropdown-panel.ts` is `180` and MUST stay equal to `--dropdown-dur` (`.18s`).
- All UI copy in Català. Keep existing `aria-*` and `role` attributes when refactoring.
- No new dependencies. `color-mix(in srgb, …)` is already used in this codebase and is allowed.
- Single light theme only (no dark-mode variants to maintain).
- Highest existing `z-index` is `320` (settings modal). The scrim token must be defined so callers can place it relative to their own overlay.

---

### Task 1: Add dropdown + scrim tokens and unify `.dropdown-panel`

**Files:**
- Modify: `src/index.css` (`:root` block ~168-201; `.dropdown-panel` block 387-402)

**Interfaces:**
- Consumes: existing tokens `--ease`, `--blur-glass`, `--blur-scrim`, `--shadow-lift`, `--surface-card`, `--dur-base`.
- Produces (CSS custom properties other tasks rely on):
  - `--dropdown-radius`, `--dropdown-dur`, `--dropdown-ease`, `--dropdown-blur`, `--dropdown-bg`, `--dropdown-shadow`, `--dropdown-offset`
  - `--scrim-bg`, `--scrim-blur`, `--z-scrim`
  - `.dropdown-panel` (glass styling) and `.ui-scrim` / `.ui-scrim.is-open` classes.

- [ ] **Step 1: Add the new tokens to `:root`**

In `src/index.css`, locate the effects block. After the blur tokens (currently lines 193-195):

```css
  --blur-bar: blur(14px);
  --blur-glass: blur(10px);
  --blur-scrim: blur(2px);
```

add, immediately after them and before the `/* ── App chrome layout` comment:

```css

  /* ── Dropdown / popover (shared by every menu) ──────── */
  --dropdown-radius: 11px;
  --dropdown-dur: .18s;
  --dropdown-ease: var(--ease);
  --dropdown-blur: var(--blur-glass);
  --dropdown-bg: color-mix(in srgb, var(--surface-card) 80%, transparent);
  --dropdown-shadow: var(--shadow-lift);
  --dropdown-offset: .5rem;

  /* ── Scrim (reusable: dropdowns, modals, toasts) ────── */
  --scrim-bg: rgba(27, 25, 36, .28);
  --scrim-blur: var(--blur-scrim);
  --z-scrim: 290;
```

(`--z-scrim: 290` sits below the detail drawer backdrop at 300 and the settings modal at 320; callers that need a scrim above those render their own stacking context.)

- [ ] **Step 2: Replace the `.dropdown-panel` rules with the tokenized, glass version**

Replace the existing block (lines 387-402, the `/* ── Header dropdown animation ── */` comment through the end of `.dropdown-panel.is-open`) with:

```css
/* ── Shared dropdown / popover panel (single source of truth) ── */
.dropdown-panel {
  opacity: 0;
  visibility: hidden;
  transform: translateY(calc(var(--dropdown-offset) * -1));
  transition: opacity var(--dropdown-dur) var(--dropdown-ease),
              transform var(--dropdown-dur) var(--dropdown-ease),
              visibility 0s linear var(--dropdown-dur);
  pointer-events: none;
  border-radius: var(--dropdown-radius);
  background: var(--dropdown-bg);
  backdrop-filter: var(--dropdown-blur);
  -webkit-backdrop-filter: var(--dropdown-blur);
  box-shadow: var(--dropdown-shadow);
}

.dropdown-panel.is-open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition: opacity var(--dropdown-dur) var(--dropdown-ease),
              transform var(--dropdown-dur) var(--dropdown-ease),
              visibility 0s linear 0s;
  pointer-events: auto;
}

/* ── Reusable scrim (add the element + `is-open`; not coupled to dropdowns) ── */
.ui-scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim-bg);
  backdrop-filter: var(--scrim-blur);
  -webkit-backdrop-filter: var(--scrim-blur);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--dur-base) var(--ease), visibility 0s linear var(--dur-base);
  z-index: var(--z-scrim);
  pointer-events: none;
}

.ui-scrim.is-open {
  opacity: 1;
  visibility: visible;
  transition: opacity var(--dur-base) var(--ease), visibility 0s linear 0s;
  pointer-events: auto;
}
```

- [ ] **Step 3: Build to verify no CSS/TS breakage**

Run: `npm run build`
Expected: build succeeds with no errors. (At this point UserMenu and GlobalSearch panels still carry their own `background`/`border-radius`/`box-shadow` which override the new shared ones — that's fine; Tasks 2-3 strip the duplicates.)

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the app, click the user-menu avatar (top-right).
Expected: the menu still opens/closes with the slide+fade animation. (Glass may not yet be visible because `.user-menu__dropdown` still sets a solid `background` — removed in Task 2.)

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(css): add dropdown + scrim tokens, glass on shared .dropdown-panel"
```

---

### Task 2: Strip redundant styling from UserMenu + GlobalSearch panels

**Files:**
- Modify: `src/index.css` (`.user-menu__dropdown` 2248-2259; `.qsearch-drop` 441-453)

**Interfaces:**
- Consumes: `.dropdown-panel` glass styling from Task 1.
- Produces: nothing new; these panels now inherit radius/bg/blur/shadow from `.dropdown-panel`.

- [ ] **Step 1: Trim `.user-menu__dropdown` to layout-only**

Replace the `.user-menu__dropdown` rule (lines 2248-2259) with:

```css
.user-menu__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  min-width: 250px;
  padding: var(--sp-3);
  border: 1px solid var(--border-subtle);
}
```

(Removed: `background`, `border-radius`, `box-shadow` — now from `.dropdown-panel`. Kept the `border`, which `.dropdown-panel` does not set.)

- [ ] **Step 2: Trim `.qsearch-drop` to layout-only**

Replace the `.qsearch-drop` rule (lines 441-453) with:

```css
.qsearch-drop {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  width: 360px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  z-index: 100;
  padding: 6px;
}
```

(Removed: `background`, `border-radius`, `box-shadow`. Kept `overflow: hidden`, width, padding, position, border.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open the user menu and the global search dropdown (focus the header search input).
Expected: both now show the same rounded corners (11px), the same glass blur over content behind them, and the same 0.18s open/close animation. They look like the same family.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "refactor(css): inherit dropdown glass on user-menu and search panels"
```

---

### Task 3: Animate the AddPanel dropdown with the shared system

**Files:**
- Modify: `src/components/AddPanelHeaderActions.tsx`
- Modify: `src/index.css` (`.add-panel-control__dropdown` 610-621)

**Interfaces:**
- Consumes: `syncDropdownPanel(el, open, state)` from `src/utils/sync-dropdown-panel.ts` (returns a timeout id or null); `.dropdown-panel` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Rewrite the component to always render the panel and animate it**

Replace the entire contents of `src/components/AddPanelHeaderActions.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { IDockviewHeaderActionsProps } from 'dockview'
import { addPanelByType } from '../panels/panel-actions'
import { PanelIcon } from '../panels/PanelIcon'
import { PANEL_DEFINITIONS, type PanelType } from '../panels/registry'
import { syncDropdownPanel } from '../utils/sync-dropdown-panel'

export function AddPanelHeaderActions(props: IDockviewHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate open/close with the shared dropdown helper.
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, isOpen, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (props.location?.type === 'edge') {
    return null
  }

  const handleToggle = () => {
    setIsOpen((value) => !value)
  }

  const handleAddPanel = (type: PanelType) => {
    addPanelByType(props.containerApi, type)
    setIsOpen(false)
  }

  return (
    <div className="add-panel-control" ref={menuRef}>
      <button
        type="button"
        className="add-panel-control__action"
        title="Afegir panell"
        aria-label="Afegir panell"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={handleToggle}
      >
        +
      </button>
      <div
        ref={dropRef}
        className="add-panel-control__dropdown dropdown-panel"
        role="menu"
        hidden
      >
        {PANEL_DEFINITIONS.map((panel) => (
          <button
            key={panel.type}
            type="button"
            role="menuitem"
            className="add-panel-control__item"
            onClick={() => handleAddPanel(panel.type)}
          >
            <PanelIcon type={panel.type} size={18} />
            {panel.title}
          </button>
        ))}
      </div>
    </div>
  )
}
```

(Key changes: panel is always mounted with `hidden` + `dropdown-panel` class; `syncDropdownPanel` toggles `is-open` and the `hidden` attribute, exactly like UserMenu.)

- [ ] **Step 2: Trim `.add-panel-control__dropdown` to layout-only**

Replace the rule (lines 610-621) with:

```css
.add-panel-control__dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  min-width: 180px;
  border: 1px solid var(--border-subtle);
  padding: var(--sp-1);
}
```

(Removed: `background`, `border-radius` (was the off-spec `--r-xs`/8px), `box-shadow`. The panel now gets 11px radius + glass + shadow from `.dropdown-panel`.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. In a Dockview tab bar, click the `+` (Afegir panell) button.
Expected: the menu now animates open/closed (0.18s slide+fade) — previously it popped instantly — with 11px corners and the same glass as the user menu.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddPanelHeaderActions.tsx src/index.css
git commit -m "feat(add-panel): use shared dropdown animation and glass"
```

---

### Task 4: Create the shared custom `Select` component

**Files:**
- Create: `src/components/ds/Select.tsx`
- Modify: `src/index.css` (append a `.ds-select*` block near the other `ds` primitives / end of file)

**Interfaces:**
- Consumes: `syncDropdownPanel` from `src/utils/sync-dropdown-panel.ts`; `.dropdown-panel` from Task 1.
- Produces:
  ```ts
  export type SelectOption<T extends string | number> = { value: T; label: string }
  export interface SelectProps<T extends string | number> {
    value: T
    options: SelectOption<T>[]
    onChange: (value: T) => void
    ariaLabel: string
    disabled?: boolean
    className?: string   // extra class on the trigger button (e.g. 'fv-select', 'settings-select')
    minWidth?: number    // optional min-width (px) for trigger + panel
  }
  export function Select<T extends string | number>(props: SelectProps<T>): JSX.Element
  ```
  Tasks 5 and 6 consume `Select` with exactly this signature.

- [ ] **Step 1: Write the component**

Create `src/components/ds/Select.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'

export type SelectOption<T extends string | number> = { value: T; label: string }

export interface SelectProps<T extends string | number> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Accessible name; mirrors the old <select aria-label>. */
  ariaLabel: string
  disabled?: boolean
  /** Extra class on the trigger (keeps existing visual sizing, e.g. 'fv-select'). */
  className?: string
  /** Optional min-width in px applied to trigger and panel. */
  minWidth?: number
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
  minWidth,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedIndex = options.findIndex((o) => o.value === value)

  // Animate open/close with the shared helper.
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  // When opening, highlight the current value.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const commit = (index: number) => {
    const opt = options[index]
    if (opt) onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return
    switch (event.key) {
      case 'Escape':
        setOpen(false)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) commit(activeIndex)
        else setOpen(true)
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (open) setActiveIndex((i) => Math.max(i - 1, 0))
        break
      default:
        break
    }
  }

  const style = minWidth ? { minWidth: `${minWidth}px` } : undefined

  return (
    <div className="ds-select" ref={rootRef}>
      <button
        type="button"
        className={`ds-select__trigger${className ? ` ${className}` : ''}`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="ds-select__value">{selected?.label ?? ''}</span>
        <span className="ds-select__caret" aria-hidden="true">▾</span>
      </button>
      <div
        ref={dropRef}
        id={listId}
        className="ds-select__panel dropdown-panel"
        role="listbox"
        aria-label={ariaLabel}
        style={style}
        hidden
      >
        {options.map((opt, index) => (
          <button
            key={String(opt.value)}
            type="button"
            role="option"
            aria-selected={opt.value === value}
            className={`ds-select__option${index === activeIndex ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => commit(index)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the `.ds-select` styles**

Append to the end of `src/index.css`:

```css
/* ── Shared custom select (design system) ── */
.ds-select {
  position: relative;
  display: inline-flex;
}

.ds-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-family: var(--font-body);
  font-size: var(--fs-sm);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--surface-card);
  color: var(--text-strong);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}

.ds-select__trigger:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring-focus);
}

.ds-select__trigger:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.ds-select__caret {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.ds-select__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  min-width: 100%;
  max-height: min(320px, 60vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border-subtle);
  padding: var(--sp-1);
}

.ds-select__option {
  display: block;
  width: 100%;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  padding: var(--sp-2) var(--sp-3);
  text-align: left;
  font: inherit;
  font-size: var(--fs-sm);
  color: var(--text-body);
  cursor: pointer;
}

.ds-select__option.is-active,
.ds-select__option:hover {
  background: var(--accent-tint);
  color: var(--text-strong);
}

.ds-select__option[aria-selected='true'] {
  font-weight: var(--fw-semibold);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, no unused-symbol or type errors. (`Select` is unused until Tasks 5-6 — TypeScript does not error on unused exports, so this is fine.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ds/Select.tsx src/index.css
git commit -m "feat(ds): add shared custom Select combo box"
```

---

### Task 5: Replace native selects in Settings with `Select`

**Files:**
- Modify: `src/components/settings/parts.tsx` (`SelectField` 74-106)
- Modify: `src/index.css` (remove now-unused `.settings-select` rules where they no longer apply)

**Interfaces:**
- Consumes: `Select`, `SelectOption` from `src/components/ds/Select.tsx` (Task 4). `SelectField` keeps its existing public signature so callers in the settings modal are untouched.
- Produces: unchanged `SelectField` API.

- [ ] **Step 1: Rewrite `SelectField` to use `Select`**

In `src/components/settings/parts.tsx`, replace the `SelectField` function (lines 74-106) with:

```tsx
export function SelectField<T extends string | number>({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={label}
      disabled={disabled}
      className="settings-select"
      minWidth={150}
    />
  )
}
```

- [ ] **Step 2: Add the import**

At the top of `src/components/settings/parts.tsx`, after the existing React import (line 6 `import { useId, type ReactNode } from 'react'`), add:

```tsx
import { Select } from '../ds/Select'
```

- [ ] **Step 3: Drop the native-select-only CSS**

In `src/index.css`, the combined rule at lines 2862-2872 styles both `.settings-select` and `.settings-input`. `.settings-select` is now applied to a `<button>` trigger via `Select`'s `className`, and the trigger already gets its base look from `.ds-select__trigger`. Split the rule so input keeps its styles and the select-specific native bits are removed.

Replace lines 2862-2877 (the `.settings-select, .settings-input { … }`, `.settings-select { … }` blocks) with:

```css
.settings-input {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-strong);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  padding: var(--sp-2) var(--sp-3);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}

.settings-select {
  min-width: 150px;
}
```

Then update the focus rule at lines 2884-2889 — change the selector `.settings-select:focus-visible, .settings-input:focus-visible` to only `.settings-input:focus-visible` (the `Select` trigger handles its own focus via `.ds-select__trigger:focus-visible`):

```css
.settings-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring-focus);
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds, no type errors (the generic `T` flows through `Select`).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Open Settings (user menu → Configuració). Open each select-type setting (e.g. default floor view).
Expected: the control opens a custom panel with 11px corners, glass blur and the 0.18s animation — identical to the header dropdowns. Selecting a value and saving still works; keyboard (Tab to focus, Enter/space to open, arrows, Enter to pick, Esc to close) works.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/parts.tsx src/index.css
git commit -m "refactor(settings): use shared custom Select"
```

---

### Task 6: Replace native selects in FloorPanel with `Select`

**Files:**
- Modify: `src/panels/FloorPanel.tsx` (the three `<select className="fv-select">` blocks, ~120-184)
- Modify: `src/index.css` (`.fv-select` 2042-2051)

**Interfaces:**
- Consumes: `Select` from `src/components/ds/Select.tsx`; `SEAT_STYLES` (already defined in FloorPanel, `Array<{ value: SeatStyle; label: string }>`).
- Produces: nothing new.

- [ ] **Step 1: Import `Select`**

In `src/panels/FloorPanel.tsx`, after line 6 (`import { PanelShell } from '../components/PanelState'`), add:

```tsx
import { Select } from '../components/ds/Select'
```

- [ ] **Step 2: Replace the Place select**

Replace the place `<select>` block (lines 121-135) with:

```tsx
              <Select
                className="fv-select"
                ariaLabel="Lloc"
                value={activePlace.id}
                options={data.places.map((place) => ({ value: place.id, label: place.name }))}
                onChange={(id) => {
                  setPlaceId(id)
                  setFloorIndex(0)
                }}
              />
```

- [ ] **Step 3: Replace the Floor select**

Replace the floor `<select>` block (lines 141-152) with:

```tsx
              <Select
                className="fv-select"
                ariaLabel="Planta"
                value={safeFloorIndex}
                options={activePlace.floors.map((floor, index) => ({ value: index, label: floor.name }))}
                onChange={(index) => setFloorIndex(index)}
              />
```

(`value` is a `number` here — `Select<number>` is inferred. `safeFloorIndex` is the existing clamped index variable.)

- [ ] **Step 4: Replace the Seat-style select**

Replace the seat-style `<select>` block (lines 173-184) with:

```tsx
                <Select
                  className="fv-select"
                  ariaLabel="Estil de seient"
                  value={seatStyle}
                  options={SEAT_STYLES}
                  onChange={(s) => setSeatStyle(s)}
                />
```

(`SEAT_STYLES` is already `Array<{ value: SeatStyle; label: string }>`, so `onChange` receives a `SeatStyle`.)

- [ ] **Step 5: Reduce `.fv-select` to a sizing tweak on the trigger**

`.fv-select` is now passed as the trigger `className`, layered on top of `.ds-select__trigger`. The base look (border, radius, background, padding) already comes from `.ds-select__trigger`, so `.fv-select` only needs to carry whatever differs. Replace the rule (lines 2042-2051) with:

```css
.fv-select {
  /* Sizing tweaks layered on .ds-select__trigger for the floor bar. */
  font-size: var(--fs-sm);
}
```

(If, on manual review, the floor-bar selects need a tighter height than the settings ones, add `padding` here — but start minimal.)

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds, no type errors. The generic `Select` infers `string` for place, `number` for floor, `SeatStyle` for seat style.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Open a Floor panel that has multiple places/floors; switch to 3D to reveal the seat-style select.
Expected: all three selects open custom panels with the same 11px corners, glass and 0.18s animation as every other dropdown. Selecting changes the view correctly. Keyboard works.

- [ ] **Step 8: Commit**

```bash
git add src/panels/FloorPanel.tsx src/index.css
git commit -m "refactor(floor): use shared custom Select"
```

---

### Task 7: Token cleanup and final coherence pass

**Files:**
- Modify: `src/index.css` (any newly-orphaned tokens / leftover redundant declarations)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: nothing new.

- [ ] **Step 1: Find orphaned tokens**

Run, for each token to check whether it is still referenced anywhere besides its own definition:

```bash
for t in --blur-glass --r-xs --r-md --blur-bar --blur-scrim; do echo "== $t =="; grep -rn "$t" src/ ; done
```

Expected reasoning: `--blur-glass` is now referenced by `--dropdown-blur` (Task 1) → keep. For any token that appears ONLY on its own definition line in `src/index.css` and nowhere else, it is orphaned.

- [ ] **Step 2: Remove or re-route orphans**

For each orphaned token found in Step 1, delete its definition line in `:root`. Do NOT delete tokens still referenced (the grep shows >1 hit). If a token is orphaned only because a sibling token now covers the same value, prefer deleting the orphan over keeping a duplicate.

(There is no code block to paste here because the exact set depends on Step 1's output — but the rule is mechanical: definition-only hit ⇒ delete that one line.)

- [ ] **Step 3: Verify the four sources of truth agree**

Confirm these still hold (grep each):

```bash
grep -n "DROPDOWN_TRANSITION_MS" src/utils/sync-dropdown-panel.ts   # must be 180
grep -n "\-\-dropdown-dur" src/index.css                            # must be .18s
grep -rn "dropdown-panel" src/components src/panels                 # UserMenu, GlobalSearch, AddPanel, Select all present
```

Expected: `180` and `.18s` match; all four consumers carry the `dropdown-panel` class.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Full manual sweep**

Run: `npm run dev`. Open, in turn: user menu, global search, add-panel (+) menu, all Floor selects, all Settings selects.
Expected: every panel shares identical open/close animation (0.18s slide+fade), identical 11px radius, identical glass blur and background opacity. No panel pops without animation; none has square or 8px/12px corners.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "chore(css): remove orphaned tokens after dropdown unification"
```

---

## Self-Review

**Spec coverage:**
- Same transition / radius / opacity / backdrop-filter for all dropdowns → Tasks 1-3 (existing dropdowns) + 4-6 (selects). ✓
- Selects converted to custom → Tasks 4-6. ✓
- Tokenize → Task 1. ✓
- Clean up orphaned/unused tokens → Task 7. ✓
- Reusable scrim for dropdowns/modals/toasts, trivial to add via a class → Task 1 (`.ui-scrim` + `--scrim-*` / `--z-scrim`). ✓
- DetailDrawer left as-is (out of scope) → not touched. ✓

**Placeholder scan:** Task 2/7 contain reasoning-not-code where the exact bytes depend on prior grep output (orphan removal); every code-producing step has full code. No TODO/TBD left.

**Type consistency:** `Select<T extends string | number>`, `SelectOption<T>`, `SelectProps<T>` defined in Task 4 and consumed verbatim in Tasks 5-6. `SelectField`'s generic `T` is preserved. `SEAT_STYLES`/`SeatStyle` referenced match FloorPanel's existing definitions. `syncDropdownPanel(el, open, state)` signature matches `src/utils/sync-dropdown-panel.ts`.
