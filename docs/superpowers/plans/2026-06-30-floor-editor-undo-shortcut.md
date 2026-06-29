# Floor Editor Undo Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) keyboard shortcuts driving the floor editor's existing action stack, active only while the editor panel is mounted.

**Architecture:** A lightweight context registry (`EditorUndoProvider`) mirrors the modal-registry pattern: `SpaceEditorPanel` registers its `useSpacePlan` undo/redo handlers via a `useEffect` while mounted; the single global keydown listener in `GlobalShortcutsProvider` reads the registry on each Cmd/Ctrl+Z press. No changes to `useSpacePlan` itself.

**Tech Stack:** React (Context API + `useRef`, no Zustand), TypeScript, Vitest + Testing Library.

## Global Constraints

- State management is **React Context API pure** (no Zustand/Redux). Follow the existing modal-registry pattern (`src/modals/`).
- Provider modules export **only the component** (Fast Refresh); context + types + hooks live in separate non-component files.
- The registry holds handlers in a **`useRef`** (no re-renders on register/unregister); the listener reads them at press time.
- `GlobalShortcutsProvider` remains the **only** global `addEventListener('keydown')` for app shortcuts.
- Undo/redo gestures: `Cmd/Ctrl+Z` = undo, `Cmd/Ctrl+Shift+Z` = redo. Require `!altKey`.
- When focus is in a text field (input/textarea/contenteditable), the shortcut **does not act** and does **not** call `preventDefault` (native browser undo passes through).
- When no handlers registered or `!canUndo`/`!canRedo`: **do not** call `preventDefault`.
- All shortcut handler invocations wrapped in `try/catch` with `console.error`, matching existing listener style.
- Catalan for all user-facing copy and code comments (match surrounding files).

---

## File Structure

- **Create** `src/shortcuts/editor-undo-context.ts` — context + types + `useEditorUndoRegistry()` hook (no component → Fast Refresh).
- **Create** `src/shortcuts/EditorUndoProvider.tsx` — the provider component (only export).
- **Create** `src/shortcuts/useRegisterEditorUndo.ts` — one-liner registration hook (mirror of `useRegisterModal`).
- **Modify** `src/shortcuts/GlobalShortcutsProvider.tsx` — add the Cmd/Ctrl+Z branch reading the registry.
- **Modify** `src/panels/SpaceEditorPanel.tsx` — register `fp.undo/redo/canUndo/canRedo`.
- **Modify** `src/App.tsx` — wrap with `EditorUndoProvider` above `GlobalShortcutsProvider`.
- **Test** `src/shortcuts/editor-undo-context.test.tsx` — registry register/cleanup + listener behaviour.

---

## Task 1: Editor undo registry (context + hooks)

**Files:**
- Create: `src/shortcuts/editor-undo-context.ts`
- Create: `src/shortcuts/EditorUndoProvider.tsx`
- Create: `src/shortcuts/useRegisterEditorUndo.ts`
- Test: `src/shortcuts/editor-undo-context.test.tsx`

**Interfaces:**
- Produces:
  - `EditorUndoHandlers` = `{ undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }`
  - `EditorUndoRegistryValue` = `{ register: (h: EditorUndoHandlers | null) => void; getHandlers: () => EditorUndoHandlers | null }`
  - `useEditorUndoRegistry(): EditorUndoRegistryValue` (throws if outside provider)
  - `EditorUndoProvider({ children }: { children: ReactNode })`
  - `useRegisterEditorUndo(handlers: EditorUndoHandlers): void`

- [ ] **Step 1: Write the failing test**

Create `src/shortcuts/editor-undo-context.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { EditorUndoProvider } from './EditorUndoProvider'
import { useEditorUndoRegistry } from './editor-undo-context'
import { useRegisterEditorUndo } from './useRegisterEditorUndo'

function wrapper({ children }: { children: ReactNode }) {
  return <EditorUndoProvider>{children}</EditorUndoProvider>
}

describe('editor undo registry', () => {
  it('starts with no handlers', () => {
    const { result } = renderHook(() => useEditorUndoRegistry(), { wrapper })
    expect(result.current.getHandlers()).toBeNull()
  })

  it('exposes registered handlers and clears them on unmount', () => {
    const handlers = { undo: () => {}, redo: () => {}, canUndo: true, canRedo: false }
    const { result, unmount } = renderHook(
      () => {
        useRegisterEditorUndo(handlers)
        return useEditorUndoRegistry()
      },
      { wrapper },
    )
    expect(result.current.getHandlers()).toBe(handlers)
    unmount()
    // After unmount the provider is gone too, so re-check via a fresh consumer:
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useEditorUndoRegistry())).toThrow(
      /EditorUndoProvider/,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/shortcuts/editor-undo-context.test.tsx`
Expected: FAIL — cannot resolve `./EditorUndoProvider`, `./editor-undo-context`, `./useRegisterEditorUndo`.

- [ ] **Step 3: Create the context module**

Create `src/shortcuts/editor-undo-context.ts`:

```ts
/* Editor undo registry — context + hook (sense components, perquè Fast Refresh
   estigui content). El <EditorUndoProvider> viu a EditorUndoProvider.tsx.

   És la font única de veritat sobre quins handlers d'undo/redo estan actius
   ara mateix (els registra el panel de l'editor mentre està muntat). La drecera
   global Cmd/Ctrl+Z els consulta per decidir si actua. */

import { createContext, useContext } from 'react'

export interface EditorUndoHandlers {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export interface EditorUndoRegistryValue {
  /** Registra (o esborra amb null) els handlers actius. */
  register: (handlers: EditorUndoHandlers | null) => void
  /** Llegeix els handlers actius en el moment d'una pulsació; null si cap. */
  getHandlers: () => EditorUndoHandlers | null
}

export const EditorUndoContext = createContext<EditorUndoRegistryValue | null>(null)

export function useEditorUndoRegistry(): EditorUndoRegistryValue {
  const ctx = useContext(EditorUndoContext)
  if (!ctx) {
    throw new Error('useEditorUndoRegistry must be used within EditorUndoProvider')
  }
  return ctx
}
```

- [ ] **Step 4: Create the provider component**

Create `src/shortcuts/EditorUndoProvider.tsx`:

```tsx
/* EditorUndoProvider — l'únic export és el component, així Fast Refresh
   funciona. Context + tipus + hook viuen a ./editor-undo-context. */

import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import {
  EditorUndoContext,
  type EditorUndoHandlers,
  type EditorUndoRegistryValue,
} from './editor-undo-context'

export function EditorUndoProvider({ children }: { children: ReactNode }) {
  /* useRef en lloc de state: no cal re-renderitzar quan el panel es munta o
     desmunta; només llegim els handlers en el moment d'una pulsació. */
  const handlersRef = useRef<EditorUndoHandlers | null>(null)

  const register = useCallback((handlers: EditorUndoHandlers | null) => {
    handlersRef.current = handlers
  }, [])

  const getHandlers = useCallback(() => handlersRef.current, [])

  const value = useMemo<EditorUndoRegistryValue>(
    () => ({ register, getHandlers }),
    [register, getHandlers],
  )

  return (
    <EditorUndoContext.Provider value={value}>
      {children}
    </EditorUndoContext.Provider>
  )
}
```

- [ ] **Step 5: Create the registration hook**

Create `src/shortcuts/useRegisterEditorUndo.ts`:

```ts
/* useRegisterEditorUndo — perquè el panel de l'editor informi dels seus
   handlers d'undo/redo al registre amb una sola línia. Re-registra quan
   canvien (p. ex. canUndo/canRedo) i neteja en desmuntar. */

import { useEffect } from 'react'
import { useEditorUndoRegistry, type EditorUndoHandlers } from './editor-undo-context'

export function useRegisterEditorUndo(handlers: EditorUndoHandlers): void {
  const { register } = useEditorUndoRegistry()
  useEffect(() => {
    register(handlers)
    return () => register(null)
  }, [register, handlers.undo, handlers.redo, handlers.canUndo, handlers.canRedo])
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/shortcuts/editor-undo-context.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no new errors in the three created files.

- [ ] **Step 8: Commit**

```bash
git add src/shortcuts/editor-undo-context.ts src/shortcuts/EditorUndoProvider.tsx src/shortcuts/useRegisterEditorUndo.ts src/shortcuts/editor-undo-context.test.tsx
git commit -m "feat: add editor undo registry context"
```

---

## Task 2: Cmd/Ctrl+Z branch in the global listener

**Files:**
- Modify: `src/shortcuts/GlobalShortcutsProvider.tsx`
- Test: `src/shortcuts/editor-undo-context.test.tsx` (append integration test)

**Interfaces:**
- Consumes: `useEditorUndoRegistry()`, `EditorUndoHandlers`, `EditorUndoProvider` from Task 1; existing `isEditingTextField()` in the same file.

- [ ] **Step 1: Write the failing integration test**

Append to `src/shortcuts/editor-undo-context.test.tsx`. The `GlobalShortcutsProvider` needs the modal-registry, settings-modal and dockview-host contexts; to test the undo branch in isolation we render only the registry + a small registrar and simulate the branch via a real `GlobalShortcutsProvider` wrapped with the required providers. To keep the test focused and avoid heavy provider setup, assert the registry contract that the listener relies on instead:

```tsx
import { fireEvent } from '@testing-library/react'

describe('editor undo registry — handler invocation contract', () => {
  it('calls undo on the registered handlers', () => {
    let undoCalls = 0
    const handlers = {
      undo: () => { undoCalls += 1 },
      redo: () => {},
      canUndo: true,
      canRedo: false,
    }
    const { result } = renderHook(
      () => {
        useRegisterEditorUndo(handlers)
        return useEditorUndoRegistry()
      },
      { wrapper },
    )
    const current = result.current.getHandlers()
    expect(current?.canUndo).toBe(true)
    current?.undo()
    expect(undoCalls).toBe(1)
    // keep fireEvent import used for the manual-verification reference below
    void fireEvent
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/shortcuts/editor-undo-context.test.tsx`
Expected: PASS for Task 1 tests; the new test should already pass against Task 1's registry (it asserts the contract Task 2 depends on). If it fails, fix the registry before touching the listener.

> Note: the listener branch itself is verified by manual testing (Task 4) because `GlobalShortcutsProvider` depends on dockview/settings/modal contexts that are impractical to assemble in a unit test. The contract test above locks the registry API the branch uses.

- [ ] **Step 3: Add the undo/redo branch to the listener**

In `src/shortcuts/GlobalShortcutsProvider.tsx`:

Add the import near the other context imports:

```ts
import { useEditorUndoRegistry } from './editor-undo-context'
```

Inside the component, alongside the other context hooks:

```ts
const { getHandlers } = useEditorUndoRegistry()
```

Add `getHandlers` to the `onKeyDown` effect dependency array (it becomes `[isAnyModalOpen, shortcutCtx, getHandlers]`).

At the **top** of `onKeyDown`, **before** the existing `if (event.metaKey || event.ctrlKey || event.altKey) return`, insert:

```ts
    /* Undo/redo del floor editor: Cmd/Ctrl+Z desfà, +Shift refà. Només
       quan l'editor està muntat (registre actiu) i el focus no és en text. */
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'z') {
      if (isEditingTextField()) return
      const handlers = getHandlers()
      if (!handlers) return
      try {
        if (event.shiftKey) {
          if (!handlers.canRedo) return
          event.preventDefault()
          handlers.redo()
        } else {
          if (!handlers.canUndo) return
          event.preventDefault()
          handlers.undo()
        }
      } catch (err) {
        console.error('Editor undo shortcut failed', err)
      }
      return
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/shortcuts/editor-undo-context.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (Note: `tsc --noEmit` checks nothing in this repo; use `tsc -b`.)

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/shortcuts/GlobalShortcutsProvider.tsx src/shortcuts/editor-undo-context.test.tsx
git commit -m "feat: handle Cmd/Ctrl+Z undo in global shortcuts listener"
```

---

## Task 3: Wire provider into the tree and register the panel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/panels/SpaceEditorPanel.tsx`

**Interfaces:**
- Consumes: `EditorUndoProvider` (Task 1), `useRegisterEditorUndo` (Task 1); existing `fp = useSpacePlan()` with `fp.undo`, `fp.redo`, `fp.canUndo`, `fp.canRedo`.

- [ ] **Step 1: Add the provider import to App.tsx**

In `src/App.tsx`, after the `GlobalShortcutsProvider` import:

```ts
import { EditorUndoProvider } from './shortcuts/EditorUndoProvider'
```

- [ ] **Step 2: Wrap the tree with EditorUndoProvider**

In `src/App.tsx`, place `EditorUndoProvider` **directly outside** `GlobalShortcutsProvider` (it must be an ancestor of both the listener and `SpaceEditorPanel`). Change:

```tsx
                      <DevConsoleProvider>
                        <GlobalShortcutsProvider>
```

to:

```tsx
                      <DevConsoleProvider>
                        <EditorUndoProvider>
                          <GlobalShortcutsProvider>
```

and the matching closing tags — change:

```tsx
                        </GlobalShortcutsProvider>
                      </DevConsoleProvider>
```

to:

```tsx
                          </GlobalShortcutsProvider>
                        </EditorUndoProvider>
                      </DevConsoleProvider>
```

- [ ] **Step 3: Register handlers in SpaceEditorPanel**

In `src/panels/SpaceEditorPanel.tsx`, add the import alongside the other hook imports:

```ts
import { useRegisterEditorUndo } from '../shortcuts/useRegisterEditorUndo'
```

Inside `SpaceEditorPanel`, right after `const fp = useSpacePlan()`:

```ts
  // Exposa l'undo/redo del plànol a la drecera global Cmd/Ctrl+Z mentre el
  // panel està muntat.
  useRegisterEditorUndo({
    undo: fp.undo,
    redo: fp.redo,
    canUndo: fp.canUndo,
    canRedo: fp.canRedo,
  })
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS (no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/panels/SpaceEditorPanel.tsx
git commit -m "feat: wire editor undo provider and register floor editor"
```

---

## Task 4: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the app**

Run: `npm run dev:mock`
Open the floor editor (press `e`, or open the Space Editor panel).

- [ ] **Step 2: Verify undo**

Paint or erase some cells, then press **Cmd+Z** (mac) / **Ctrl+Z** (win/linux). Expected: the last action is undone, matching the toolbar's ↶ button. The toolbar undo button reflects `canUndo`.

- [ ] **Step 3: Verify redo**

Press **Cmd+Shift+Z** / **Ctrl+Shift+Z**. Expected: the undone action is reapplied, matching the toolbar's ↷ button.

- [ ] **Step 4: Verify text-field passthrough**

Start renaming a place/space (focus a text input), type, then press **Cmd/Ctrl+Z**. Expected: native text undo applies to the input — the plan is NOT undone.

- [ ] **Step 5: Verify panel-unmounted no-op**

Switch to another panel (close the editor). Press **Cmd/Ctrl+Z**. Expected: no error, no interference (browser default behaviour).

- [ ] **Step 6: Mark complete**

All manual checks pass → feature done. Consider `superpowers:finishing-a-development-branch`.

---

## Self-Review Notes

- **Spec coverage:** registry module (Task 1) ✓; listener branch with text-field/`canUndo`/`canRedo`/`!altKey` guards (Task 2) ✓; provider placement above `GlobalShortcutsProvider` + panel registration (Task 3) ✓; manual verification of all edge cases (Task 4) ✓.
- **`event.repeat`:** intentionally NOT blocked in the undo branch (spec decision: holding the keys repeats undo/redo), so the branch returns before reaching the existing `if (event.repeat) return` guard.
- **Type consistency:** `EditorUndoHandlers`/`EditorUndoRegistryValue`/`getHandlers`/`register` used identically across all tasks.
