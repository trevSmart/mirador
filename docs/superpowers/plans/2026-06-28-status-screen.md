# StatusScreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified full-screen status component (`StatusScreen`) and route all full-screen states (auth error, real redirect-in-progress, render crash) through it, removing the misleading header `<span>` error and the hung "Redirigint…" spinner.

**Architecture:** A pure presentational `StatusScreen` component (props: tone, title, message, detail, actions, busy) renders the visual. A new `AppGate` component, mounted inside `AuthProvider`, reads `useAuth()` and decides between the app, an auth-error screen, and a busy redirect screen. The existing generic `ErrorBoundary` class is reused; only its global fallback in `App.tsx` is swapped to a `StatusScreen`. The old global `ErrorFallback` and the header error/redirect chips are deleted.

**Tech Stack:** React + TypeScript, Vite, Vitest + jsdom + @testing-library/react. Single stylesheet at `src/index.css`.

## Global Constraints

- All user-facing copy in Català, with correct accents/diacritics.
- Single stylesheet: add styles to `src/index.css` (no new `.css` files).
- New `StatusScreen` uses its own `status-screen__*` class vocabulary — do NOT reuse `error-fallback__*` classes (those remain owned by the still-live panel system).
- Test runner: `npm test` (runs `vitest run`). Watch: `npm run test:watch`.
- Lint gate: `npm run lint` must pass (no unused imports/exports — `knip --strict` is also in the repo).
- `useAuth()` must be called within `<AuthProvider>` or it throws ([auth-context.ts:26-31](../../../src/auth/auth-context.ts)).
- `login` already resets `authError` and restarts OAuth ([AuthProvider.tsx:120-123](../../../src/auth/AuthProvider.tsx)).

---

## File Structure

- Create: `src/components/status/StatusScreen.tsx` — pure presentational full-screen status component.
- Create: `src/components/status/StatusScreen.test.tsx` — unit tests for StatusScreen.
- Create: `src/components/status/AppGate.tsx` — auth-aware decision component (app vs auth-error vs busy redirect).
- Create: `src/components/status/AppGate.test.tsx` — tests for AppGate routing.
- Modify: `src/index.css` — add `status-screen` style section.
- Modify: `src/App.tsx` — wrap `AppContent` in `AppGate`; swap global `ErrorBoundary` fallback to `StatusScreen`; drop `ErrorFallback` import.
- Modify: `src/components/AppHeader.tsx` — remove `app-header__error` block and the "Redirigint a Salesforce…" branch.
- Delete: `src/components/error/ErrorFallback.tsx` — replaced by `StatusScreen` at the global boundary.
- Modify: `src/index.css` — remove the now-unused `.error-fallback--global` rule (keep all other `error-fallback*` rules — still used by `PanelErrorFallback`).

---

## Task 1: StatusScreen component

**Files:**
- Create: `src/components/status/StatusScreen.tsx`
- Test: `src/components/status/StatusScreen.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type StatusScreenTone = 'error' | 'info' | 'neutral'
  export interface StatusScreenAction {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  export interface StatusScreenProps {
    tone?: StatusScreenTone
    title: string
    message?: string
    detail?: string
    detailLabel?: string
    actions?: StatusScreenAction[]
    busy?: boolean
  }
  export function StatusScreen(props: StatusScreenProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/components/status/StatusScreen.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusScreen } from './StatusScreen'

describe('StatusScreen', () => {
  it('renders title, message and detail', () => {
    render(
      <StatusScreen
        title="No s'ha pogut connectar"
        message="Hi ha hagut un problema."
        detail="raw error text"
        detailLabel="Detalls"
      />,
    )
    expect(screen.getByText("No s'ha pogut connectar")).toBeInTheDocument()
    expect(screen.getByText('Hi ha hagut un problema.')).toBeInTheDocument()
    expect(screen.getByText('raw error text')).toBeInTheDocument()
    expect(screen.getByText('Detalls')).toBeInTheDocument()
  })

  it('renders one button per action and fires onClick', () => {
    const onRetry = vi.fn()
    render(
      <StatusScreen
        title="X"
        actions={[
          { label: 'Reintenta', onClick: onRetry, variant: 'primary' },
          { label: 'Recarrega', onClick: () => {} },
        ]}
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    screen.getByText('Reintenta').click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders no action row when actions is empty or absent', () => {
    render(<StatusScreen title="X" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a spinner when busy and no dot', () => {
    const { container } = render(<StatusScreen title="Carregant" busy />)
    expect(container.querySelector('.status-screen__spinner')).not.toBeNull()
    expect(container.querySelector('.status-screen__dot')).toBeNull()
  })

  it('uses role=alert for error tone and role=status otherwise', () => {
    const { rerender } = render(<StatusScreen title="X" tone="error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<StatusScreen title="X" tone="info" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/status/StatusScreen.test.tsx`
Expected: FAIL — cannot resolve `./StatusScreen`.

- [ ] **Step 3: Write the implementation**

Create `src/components/status/StatusScreen.tsx`:

```tsx
export type StatusScreenTone = 'error' | 'info' | 'neutral'

export interface StatusScreenAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export interface StatusScreenProps {
  tone?: StatusScreenTone
  title: string
  message?: string
  detail?: string
  detailLabel?: string
  actions?: StatusScreenAction[]
  busy?: boolean
}

export function StatusScreen({
  tone = 'neutral',
  title,
  message,
  detail,
  detailLabel,
  actions,
  busy = false,
}: StatusScreenProps) {
  return (
    <div
      className={`status-screen status-screen--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="status-screen__card">
        <div className="status-screen__header">
          {busy ? (
            <span className="status-screen__spinner" aria-hidden="true" />
          ) : (
            <span className="status-screen__dot" aria-hidden="true" />
          )}
          <h1 className="status-screen__title">{title}</h1>
        </div>

        {message ? <p className="status-screen__message">{message}</p> : null}

        {detail ? (
          <div className="status-screen__detail">
            {detailLabel ? (
              <p className="status-screen__detail-label">{detailLabel}</p>
            ) : null}
            <pre className="status-screen__pre">{detail}</pre>
          </div>
        ) : null}

        {actions && actions.length > 0 ? (
          <div className="status-screen__actions">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={`status-screen__btn${
                  action.variant === 'primary' ? ' status-screen__btn--primary' : ''
                }`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/status/StatusScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/status/StatusScreen.tsx src/components/status/StatusScreen.test.tsx
git commit -m "feat: add StatusScreen full-screen status component"
```

---

## Task 2: StatusScreen styles

**Files:**
- Modify: `src/index.css` (add a new `status-screen` section near the existing `error-fallback` section, around line 4500)

**Interfaces:**
- Consumes: class names emitted by Task 1 (`status-screen`, `--error|--info|--neutral`, `__card`, `__header`, `__dot`, `__spinner`, `__title`, `__message`, `__detail`, `__detail-label`, `__pre`, `__actions`, `__btn`, `__btn--primary`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the style block**

Append this block to `src/index.css` (place it right after the `.error-fallback__pre { ... }` rule block, near line 4620). Uses existing design tokens already present in the file (`--surface-canvas`, `--surface-card`, `--status-alert`, `--status-watch`, etc.):

```css
/* StatusScreen — unified full-screen status (auth error, redirect, crash) */
.status-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: var(--sp-10);
  background: var(--surface-canvas);
  color: var(--text-strong);
}

.status-screen__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-5);
  width: 100%;
  max-width: 480px;
  padding: var(--sp-8);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  box-shadow: var(--shadow);
}

.status-screen__header {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
}

.status-screen__dot {
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border-radius: var(--r-full);
  flex-shrink: 0;
  background: var(--text-muted);
}

.status-screen--error .status-screen__dot {
  background: var(--status-alert);
}

.status-screen--info .status-screen__dot {
  background: var(--status-watch);
}

.status-screen__spinner {
  width: 16px;
  height: 16px;
  margin-top: 3px;
  border-radius: var(--r-full);
  border: 2px solid color-mix(in srgb, var(--text-muted) 30%, transparent);
  border-top-color: var(--text-body);
  flex-shrink: 0;
  animation: status-screen-spin 0.7s linear infinite;
}

@keyframes status-screen-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-screen__spinner {
    animation: none;
  }
}

.status-screen__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-tight);
  line-height: var(--lh-snug);
  color: var(--text-strong);
}

.status-screen__message {
  margin: 0;
  font-size: var(--fs-body);
  line-height: var(--lh-relaxed);
  color: var(--text-body);
}

.status-screen__detail {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 100%;
}

.status-screen__detail-label {
  margin: 0;
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-caps);
  text-transform: uppercase;
  color: var(--text-muted);
}

.status-screen__pre {
  margin: 0;
  width: 100%;
  box-sizing: border-box;
  padding: var(--sp-4);
  background: var(--surface-well);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--status-alert);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  line-height: var(--lh-normal);
  color: var(--text-strong);
  white-space: pre-wrap;
  word-break: break-word;
}

.status-screen__actions {
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

.status-screen__btn {
  font: inherit;
  cursor: pointer;
  padding: var(--sp-2) var(--sp-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--surface-card);
  color: var(--text-strong);
  transition:
    background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.status-screen__btn:hover {
  background: var(--surface-raised);
  border-color: var(--border-strong);
}

.status-screen__btn--primary {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}

.status-screen__btn--primary:hover {
  background: var(--accent);
  border-color: var(--accent);
  filter: brightness(0.95);
}
```

These mirror the existing `.error-fallback__btn*` rules (`src/index.css` ~4644-4672), which are the proven token set for this UI. All tokens are confirmed present in `:root` (`--accent`, `--accent-fg`, `--surface-raised`, `--border-strong`, `--dur-fast`, `--ease`).

- [ ] **Step 2: Verify token names exist**

Run: `grep -n "\-\-accent-fg\|\-\-surface-raised\|\-\-border-strong\|\-\-dur-fast\|\-\-ease\b\|\-\-surface-well\|\-\-status-watch\|\-\-ls-caps\|\-\-fs-2xs" src/index.css | head`
Expected: each token appears (defined in `:root`).

- [ ] **Step 3: Build to verify CSS is valid and tokens resolve**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: add StatusScreen styles"
```

---

## Task 3: AppGate — auth-aware routing

**Files:**
- Create: `src/components/status/AppGate.tsx`
- Test: `src/components/status/AppGate.test.tsx`

**Interfaces:**
- Consumes: `StatusScreen` from Task 1; `useAuth()` from [auth-context.ts](../../../src/auth/auth-context.ts) returning `{ authError, isAuthenticated, isSalesforceEnabled, login, ... }`.
- Produces:
  ```ts
  export function AppGate({ children }: { children: React.ReactNode }): JSX.Element
  ```
  Renders `children` normally; shows a `StatusScreen` when `authError` is set, or a busy redirect screen when a real auto-login redirect is in progress.

- [ ] **Step 1: Write the failing tests**

Create `src/components/status/AppGate.test.tsx`. The test mocks `useAuth` so it does not need a real `<AuthProvider>`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const useAuthMock = vi.fn()
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => useAuthMock(),
}))

import { AppGate } from './AppGate'

function authState(overrides: Record<string, unknown> = {}) {
  return {
    authError: null,
    isAuthenticated: true,
    isSalesforceEnabled: true,
    login: vi.fn(),
    ...overrides,
  }
}

describe('AppGate', () => {
  beforeEach(() => useAuthMock.mockReset())

  it('renders children when authenticated and no error', () => {
    useAuthMock.mockReturnValue(authState())
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.getByText('APP CONTENT')).toBeInTheDocument()
  })

  it('shows an error StatusScreen with the raw authError as detail', () => {
    useAuthMock.mockReturnValue(
      authState({ authError: 'External client app is not installed in this org', isAuthenticated: false }),
    )
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.queryByText('APP CONTENT')).toBeNull()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText('External client app is not installed in this org'),
    ).toBeInTheDocument()
  })

  it('Reintenta button calls login', () => {
    const login = vi.fn()
    useAuthMock.mockReturnValue(
      authState({ authError: 'boom', isAuthenticated: false, login }),
    )
    render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    screen.getByText('Reintenta').click()
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('shows a busy redirect screen when login is in progress', () => {
    useAuthMock.mockReturnValue(
      authState({ authError: null, isAuthenticated: false, isSalesforceEnabled: true }),
    )
    const { container } = render(
      <AppGate>
        <div>APP CONTENT</div>
      </AppGate>,
    )
    expect(screen.queryByText('APP CONTENT')).toBeNull()
    expect(container.querySelector('.status-screen__spinner')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/status/AppGate.test.tsx`
Expected: FAIL — cannot resolve `./AppGate`.

- [ ] **Step 3: Write the implementation**

Create `src/components/status/AppGate.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/auth-context'
import { StatusScreen } from './StatusScreen'

export function AppGate({ children }: { children: ReactNode }) {
  const { authError, isAuthenticated, isSalesforceEnabled, login } = useAuth()

  if (authError) {
    return (
      <StatusScreen
        tone="error"
        title="No s'ha pogut connectar a Salesforce"
        message="Hi ha hagut un problema en autenticar amb Salesforce."
        detail={authError}
        detailLabel="Detalls"
        actions={[
          { label: 'Reintenta', onClick: () => void login(), variant: 'primary' },
          { label: 'Recarrega la pàgina', onClick: () => window.location.reload() },
        ]}
      />
    )
  }

  if (isSalesforceEnabled && !isAuthenticated) {
    return <StatusScreen tone="info" busy title="Connectant amb Salesforce…" />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/status/AppGate.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/status/AppGate.tsx src/components/status/AppGate.test.tsx
git commit -m "feat: add AppGate auth-aware full-screen routing"
```

---

## Task 4: Wire AppGate + StatusScreen into App, swap global boundary fallback

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppGate` (Task 3), `StatusScreen` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Edit `src/App.tsx`**

Replace the `ErrorFallback` import line:

```tsx
import { ErrorFallback } from './components/error/ErrorFallback'
```

with:

```tsx
import { StatusScreen } from './components/status/StatusScreen'
import { AppGate } from './components/status/AppGate'
```

Then change the `ErrorBoundary` usage so its fallback is a `StatusScreen` and its child is wrapped in `AppGate`. Replace:

```tsx
                          <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
                            <AppContent />
                          </ErrorBoundary>
```

with:

```tsx
                          <ErrorBoundary
                            fallback={(error, reset) => (
                              <StatusScreen
                                tone="error"
                                title="Alguna cosa ha fallat"
                                message="S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista."
                                detail={error.message}
                                detailLabel="Detalls de l'error"
                                actions={[
                                  { label: 'Torna-ho a provar', onClick: reset, variant: 'primary' },
                                  { label: 'Recarrega la pàgina', onClick: () => window.location.reload() },
                                ]}
                              />
                            )}
                          >
                            <AppGate>
                              <AppContent />
                            </AppGate>
                          </ErrorBoundary>
```

- [ ] **Step 2: Run lint + full test suite**

Run: `npm run lint && npm test`
Expected: PASS. (`ErrorFallback` is no longer imported anywhere — confirmed in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: route app through AppGate and StatusScreen at the global boundary"
```

---

## Task 5: Remove the old global ErrorFallback + header chips

**Files:**
- Delete: `src/components/error/ErrorFallback.tsx`
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/index.css` (remove `.error-fallback--global` rule only)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Confirm ErrorFallback has no remaining references**

Run: `grep -rn "ErrorFallback\b" src --include="*.tsx" --include="*.ts" | grep -v "PanelErrorFallback"`
Expected: NO output (the only match should have been `App.tsx`, removed in Task 4). If any remain, stop and resolve them first.

- [ ] **Step 2: Delete the file**

Run: `git rm src/components/error/ErrorFallback.tsx`

- [ ] **Step 3: Remove the header error block and redirect branch**

In `src/components/AppHeader.tsx`, delete the auth-error `<span>` block (the JSX guarded by `authError ?`):

```tsx
        {authError ? (
          <span className="app-header__error" title={authError}>
            {authError}
          </span>
        ) : null}
```

And in the trailing session-status conditional, remove the redirect branch. Change:

```tsx
        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <UserMenu />
        ) : isSalesforceEnabled && !authError ? (
          <span className="app-header__status">Redirigint a Salesforce…</span>
        ) : null}
```

to:

```tsx
        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <UserMenu />
        ) : null}
```

- [ ] **Step 4: Remove now-unused `authError`/`isSalesforceEnabled` from the header if newly unused**

Check whether `authError` and `isSalesforceEnabled` are still referenced elsewhere in `AppHeader.tsx`:

Run: `grep -n "authError\|isSalesforceEnabled" src/components/AppHeader.tsx`
- `isSalesforceEnabled` is still used by the `app-header__warning` block (config warning) — keep it.
- `authError` should now have NO remaining references. If so, remove `authError` from the `useAuth()` destructuring at the top of the component (line ~14): change `const { authError, isAuthenticated, isLoading, isMockMode, isSalesforceEnabled } = useAuth()` to drop `authError`.

- [ ] **Step 5: Remove the unused `.error-fallback--global` CSS rule**

In `src/index.css`, delete only this rule block (keep every other `.error-fallback*` rule — they are still used by `PanelErrorFallback`):

```css
.error-fallback--global {
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: var(--sp-10);
  background: var(--surface-canvas);
}
```

- [ ] **Step 6: Run lint + tests + knip to confirm nothing dangling**

Run: `npm run lint && npm test`
Expected: PASS.
Run: `npm run knip`
Expected: no report of `ErrorFallback` or `error-fallback--global` as the change's fault. (Pre-existing unrelated knip findings may exist; only the lines you touched matter.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove global ErrorFallback and header auth-error/redirect chips"
```

---

## Self-Review notes

- **Spec coverage:** StatusScreen component (T1) + styles (T2); AppGate auth routing incl. busy redirect (T3); global boundary swap (T4); cleanup of ErrorFallback + header chips + `error-fallback--global` (T5). The "conserve PanelErrorFallback / error-fallback--panel" decision is enforced by deleting only `--global` and grepping in T5 Step 1.
- **Type consistency:** `StatusScreenProps`/`StatusScreenAction` defined in T1 are used verbatim in T3/T4. `AppGate({ children })` signature matches its usage in T4.
- **TODO migration:** already recorded in `docs/TODO.md` during the spec phase — no task needed here.
