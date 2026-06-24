# Error Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afegir Error Boundaries (global + per panell) perquè un error de render no deixi l'app en blanc.

**Architecture:** Un component de classe `ErrorBoundary` propi i reutilitzable, parametritzat per un render-prop `fallback`. S'usa una vegada de forma global envoltant `AppContent` (fallback de pantalla completa) i una vegada per panell, embolcallant cada component del `PANEL_COMPONENTS` registry (fallback compacte). Zero dependències noves.

**Tech Stack:** React 19, TypeScript, Vite. CSS global a `src/index.css` amb variables custom (`--surface-*`, `--text-*`, `--border-*`, `--accent`, `--r-*`).

## Global Constraints

- **Zero dependències noves.** Només `react` / `react-dom` ja presents. No afegir `react-error-boundary`.
- **TypeScript estricte:** tot tipat, sense `any`. `tsc` ha de passar net.
- **ESLint ha de passar net** (`eslint-plugin-react-hooks`, `react-refresh`).
- **Estil:** reutilitzar variables CSS existents (`--surface-card`, `--surface-raised`, `--text-strong`, `--text-body`, `--text-muted`, `--border-subtle`, `--border-strong`, `--accent`, `--accent-fg`, `--r-md`, `--r-lg`). No introduir colors hardcoded fora d'aquestes variables.
- **Sense framework de test** (el projecte no en té cap). Verificació via `tsc`, `eslint`, build de Vite i prova manual amb un `throw` temporal.
- **Català** als textos visibles a l'usuari.

---

### Task 1: Component `ErrorBoundary` genèric

**Files:**
- Create: `src/components/error/ErrorBoundary.tsx`

**Interfaces:**
- Produces:
  - `ErrorBoundary` — class component. Props: `{ children: ReactNode; fallback: (error: Error, reset: () => void) => ReactNode }`.
  - Comportament: captura errors de render dels fills, fa `console.error(error, info.componentStack)`, i renderitza `fallback(error, reset)` quan hi ha error. `reset` neteja l'estat i remunta `children`.

- [ ] **Step 1: Escriure el component**

Crear `src/components/error/ErrorBoundary.tsx`:

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset)
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: cap error nou relacionat amb `ErrorBoundary.tsx`.

- [ ] **Step 3: Verificar lint**

Run: `npx eslint src/components/error/ErrorBoundary.tsx`
Expected: cap error/warning.

- [ ] **Step 4: Commit**

```bash
git add src/components/error/ErrorBoundary.tsx
git commit -m "feat(error-boundary): add reusable ErrorBoundary class component"
```

---

### Task 2: Fallbacks `ErrorFallback` (global) i `PanelErrorFallback` (panell) + CSS

**Files:**
- Create: `src/components/error/ErrorFallback.tsx`
- Create: `src/components/error/PanelErrorFallback.tsx`
- Modify: `src/index.css` (afegir bloc d'estils al final)

**Interfaces:**
- Consumes: cap (només props pròpies).
- Produces:
  - `ErrorFallback` — `FunctionComponent<{ error: Error; reset: () => void }>`. Pantalla completa.
  - `PanelErrorFallback` — `FunctionComponent<{ error: Error; reset: () => void }>`. UI compacta.

- [ ] **Step 1: Escriure `ErrorFallback`**

Crear `src/components/error/ErrorFallback.tsx`:

```tsx
interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--global" role="alert">
      <div className="error-fallback__card">
        <h1 className="error-fallback__title">Alguna cosa ha fallat</h1>
        <p className="error-fallback__message">
          S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista.
        </p>
        <details className="error-fallback__details">
          <summary>Detalls de l'error</summary>
          <pre className="error-fallback__pre">{error.message}</pre>
        </details>
        <div className="error-fallback__actions">
          <button type="button" className="error-fallback__btn error-fallback__btn--primary" onClick={reset}>
            Torna-ho a provar
          </button>
          <button type="button" className="error-fallback__btn" onClick={() => window.location.reload()}>
            Recarrega la pàgina
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Escriure `PanelErrorFallback`**

Crear `src/components/error/PanelErrorFallback.tsx`:

```tsx
interface PanelErrorFallbackProps {
  error: Error
  reset: () => void
}

export function PanelErrorFallback({ error, reset }: PanelErrorFallbackProps) {
  return (
    <div className="error-fallback error-fallback--panel" role="alert">
      <p className="error-fallback__message">Aquest panell ha trobat un error.</p>
      <pre className="error-fallback__pre error-fallback__pre--compact">{error.message}</pre>
      <button type="button" className="error-fallback__btn error-fallback__btn--primary" onClick={reset}>
        Torna-ho a provar
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Afegir CSS al final de `src/index.css`**

Afegir aquest bloc al final del fitxer:

```css
/* ── Error boundary fallbacks ── */
.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-strong);
}

.error-fallback--global {
  height: 100%;
  width: 100%;
  padding: 32px;
}

.error-fallback__card {
  max-width: 460px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  text-align: center;
}

.error-fallback__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong);
}

.error-fallback__message {
  margin: 0;
  font-size: 14px;
  color: var(--text-body);
}

.error-fallback__details {
  text-align: left;
  font-size: 13px;
  color: var(--text-muted);
}

.error-fallback__details > summary {
  cursor: pointer;
  user-select: none;
}

.error-fallback__pre {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: var(--surface-well);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.error-fallback__pre--compact {
  max-height: 120px;
  overflow-y: auto;
}

.error-fallback__actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.error-fallback__btn {
  appearance: none;
  cursor: pointer;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--surface-card);
  color: var(--text-strong);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.error-fallback__btn:hover {
  background: var(--surface-raised);
  border-color: var(--border-strong);
}

.error-fallback__btn--primary {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}

.error-fallback__btn--primary:hover {
  background: var(--accent);
  border-color: var(--accent);
  filter: brightness(0.95);
}

.error-fallback--panel {
  height: 100%;
  padding: 24px;
  text-align: center;
}

.error-fallback--panel .error-fallback__pre {
  max-width: 360px;
  width: 100%;
}
```

- [ ] **Step 4: Verificar typecheck i lint**

Run: `npx tsc --noEmit && npx eslint src/components/error/`
Expected: cap error.

- [ ] **Step 5: Commit**

```bash
git add src/components/error/ErrorFallback.tsx src/components/error/PanelErrorFallback.tsx src/index.css
git commit -m "feat(error-boundary): add global and panel fallback UIs"
```

---

### Task 3: Boundary global a `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ErrorBoundary` (Task 1), `ErrorFallback` (Task 2).

- [ ] **Step 1: Afegir imports a `src/App.tsx`**

Afegir aquestes dues línies a la zona d'imports:

```tsx
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { ErrorFallback } from './components/error/ErrorFallback'
```

- [ ] **Step 2: Embolcallar `AppContent` dins de tots els providers**

A la funció `App`, reemplaçar `<AppContent />` (línia 36) per:

```tsx
<ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
  <AppContent />
</ErrorBoundary>
```

El resultat dins de `SettingsModalProvider` ha de quedar així:

```tsx
<SettingsModalProvider>
  <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
    <AppContent />
  </ErrorBoundary>
</SettingsModalProvider>
```

- [ ] **Step 3: Verificar typecheck i lint**

Run: `npx tsc --noEmit && npx eslint src/App.tsx`
Expected: cap error.

- [ ] **Step 4: Prova manual del fallback global**

Afegir temporalment `throw new Error('test global boundary')` a dalt de tot del cos de `AppContent` (`src/App.tsx`). Executar `npm run dev`, obrir l'app i confirmar que es veu la pantalla "Alguna cosa ha fallat" amb els dos botons. Treure el `throw` després de confirmar.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(error-boundary): wrap AppContent with global error boundary"
```

---

### Task 4: Boundary per panell al registry

**Files:**
- Modify: `src/panels/registry.ts`

**Interfaces:**
- Consumes: `ErrorBoundary` (Task 1), `PanelErrorFallback` (Task 2).
- Produces: `PANEL_COMPONENTS` amb cada panell embolcallat en un boundary. La signatura pública (`Record<PanelType, FunctionComponent<IDockviewPanelProps>>`) no canvia.

- [ ] **Step 1: Afegir imports a `src/panels/registry.ts`**

Afegir a la zona d'imports (`createElement` és necessari perquè `registry.ts` no és un fitxer `.tsx`):

```ts
import { createElement } from 'react'
import { ErrorBoundary } from '../components/error/ErrorBoundary'
import { PanelErrorFallback } from '../components/error/PanelErrorFallback'
```

- [ ] **Step 2: Afegir el helper `withPanelErrorBoundary`**

Afegir aquesta funció just abans de la definició de `PANEL_COMPONENTS` (sobre la línia 41):

```ts
function withPanelErrorBoundary(
  PanelComponent: FunctionComponent<IDockviewPanelProps>,
): FunctionComponent<IDockviewPanelProps> {
  const Wrapped: FunctionComponent<IDockviewPanelProps> = (props) =>
    createElement(
      ErrorBoundary,
      {
        fallback: (error, reset) =>
          createElement(PanelErrorFallback, { error, reset }),
      },
      createElement(PanelComponent, props),
    )
  Wrapped.displayName = `PanelErrorBoundary(${PanelComponent.displayName ?? PanelComponent.name ?? 'Panel'})`
  return Wrapped
}
```

- [ ] **Step 3: Aplicar el helper a `PANEL_COMPONENTS`**

Reemplaçar la definició de `PANEL_COMPONENTS` (línies 41-43) per:

```ts
export const PANEL_COMPONENTS = Object.fromEntries(
  PANEL_DEFINITIONS.map((panel) => [panel.type, withPanelErrorBoundary(panel.component)]),
) as Record<PanelType, FunctionComponent<IDockviewPanelProps>>
```

- [ ] **Step 4: Verificar typecheck i lint**

Run: `npx tsc --noEmit && npx eslint src/panels/registry.ts`
Expected: cap error.

- [ ] **Step 5: Prova manual del fallback de panell**

Afegir temporalment `throw new Error('test panel boundary')` a dalt del cos de `HomePanel` (`src/panels/HomePanel.tsx`). Executar `npm run dev`, confirmar que el panell Home mostra "Aquest panell ha trobat un error." mentre la resta de la graella segueix funcionant, i que "Torna-ho a provar" reintenta. Treure el `throw` després.

- [ ] **Step 6: Commit**

```bash
git add src/panels/registry.ts
git commit -m "feat(error-boundary): wrap each dockview panel in an error boundary"
```

---

### Task 5: Verificació final i build

**Files:** cap (només verificació).

- [ ] **Step 1: Confirmar que no queden `throw` de prova**

Run: `git grep -n "test global boundary\|test panel boundary" src || echo "net"`
Expected: `net`.

- [ ] **Step 2: Typecheck, lint i build complets**

Run: `npx tsc --noEmit && npx eslint src && npm run build`
Expected: tot passa sense errors.

- [ ] **Step 3: Commit final (si hi ha canvis pendents)**

Si `git status` mostra canvis, fer commit; si no, ometre aquest pas.

---

## Notes per a l'executor

- L'ordre de tasques és estricte: Task 1 → 2 → 3 → 4 → 5. Tasks 3 i 4 depenen de 1 i 2.
- `registry.ts` és `.ts` (no `.tsx`), per això s'usa `createElement` en comptes de JSX a Task 4.
- El boundary global va **dins** de tots els providers (perquè el fallback segueixi dins l'arbre de contexts), tal com especifica el disseny.
