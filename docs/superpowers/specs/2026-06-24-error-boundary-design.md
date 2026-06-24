# Error Boundary — Disseny

**Issue:** [#14 — Afegir Error Boundary (cap gestió d'errors de render)](https://github.com/trevSmart/Mirador/issues/14)
**Data:** 2026-06-24

## Problema

L'app no té cap Error Boundary. Si qualsevol component llança un error no
capturat durant el render, l'app sencera es trenca amb pantalla en blanc.
Això és especialment greu en components complexos (`GlobalSearch`,
`FloorView3D`) i amb 6 nivells de providers imbricats a `App.tsx`.

## Decisions

- **Boundary propi**, no `react-error-boundary`. El projecte és deliberadament
  lean (només `react`, `react-dom`, `dockview-react`, `lenis`). Un component de
  classe de ~50 línies cobreix el cas d'ús (fallback + recuperació) sense
  afegir una dependència nova.
- **Abast: global + per panell.** Un boundary arrel envoltant `AppContent` i un
  boundary per cada panell dockview. (Un boundary granular extra dins de
  `FloorView3D` queda ajornat: ja el cobreix el boundary del seu panell.)

## Components

```
src/components/error/
  ErrorBoundary.tsx       — class component genèrica reutilitzable
  ErrorFallback.tsx       — UI de fallback global (pantalla sencera)
  PanelErrorFallback.tsx  — UI de fallback compacta per a panells
```

### `ErrorBoundary`

Class component genèrica i reutilitzable.

- **Props:** `children`, `fallback: (error: Error, reset: () => void) => ReactNode`.
- **Estat:** `{ error: Error | null }`.
- `static getDerivedStateFromError(error)` → desa l'error i mostra el fallback.
- `componentDidCatch(error, info)` → `console.error(error, info.componentStack)`.
  Logging mínim, sense servei extern (no n'hi ha cap al projecte).
- `reset()` → torna l'estat a `{ error: null }`, es passa al `fallback` perquè
  el botó "Torna-ho a provar" pugui remuntar els fills.
- `render()` → si hi ha error, retorna `fallback(error, reset)`; si no,
  `children`.

### `ErrorFallback` (global)

Pantalla completa centrada:
- Títol: "Alguna cosa ha fallat".
- Missatge curt + `error.message` dins d'un `<details>` collapsable.
- Botó **"Torna-ho a provar"** → `reset()`.
- Botó **"Recarrega la pàgina"** → `window.location.reload()`.

### `PanelErrorFallback` (per panell)

UI compacta dins del panell:
- Missatge breu: "Aquest panell ha trobat un error."
- `error.message` en text petit.
- Botó **"Torna-ho a provar"** → `reset()` (remunta només el contingut del panell).

## Ubicació dels boundaries

### Global — `src/App.tsx`

Envoltant `AppContent` per dins de tots els providers, de manera que el
fallback pugui seguir dins l'arbre de contexts:

```tsx
<SettingsModalProvider>
  <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
    <AppContent />
  </ErrorBoundary>
</SettingsModalProvider>
```

### Per panell — `src/panels/registry.ts`

`PANEL_COMPONENTS` es construeix mapejant `PANEL_DEFINITIONS`. Cada
`component` s'embolcalla amb un wrapper que hi posa un `ErrorBoundary` +
`PanelErrorFallback`. Una sola modificació cobreix els 8 panells
(inclosos `FloorPanel` i `FloorEditorPanel`, que contenen `FloorView3D`).

```ts
export const PANEL_COMPONENTS = Object.fromEntries(
  PANEL_DEFINITIONS.map((panel) => [panel.type, withPanelErrorBoundary(panel.component)]),
) as Record<PanelType, FunctionComponent<IDockviewPanelProps>>
```

On `withPanelErrorBoundary(Component)` retorna un component que renderitza
`<ErrorBoundary fallback={...PanelErrorFallback...}><Component {...props} /></ErrorBoundary>`.

## Estil

Seguir els patrons CSS existents del projecte (classes a `index.css` /
convenció vigent dels altres components). Revisar com s'estilen components
actuals abans d'escriure el CSS per ser coherent.

## Fora d'abast (YAGNI)

- Boundary granular extra al voltant de `FloorView3D` (cobert pel del panell).
- Llibreria `react-error-boundary`.
- Reporting d'errors a un servei extern.
- Afegir un framework de test (el projecte no en té cap).

## Verificació

- `tsc` (typecheck) i `eslint` passen.
- Build de Vite OK.
- Prova manual: `throw` temporal dins d'un panell → es veu el `PanelErrorFallback`
  i la resta de la graella segueix viva; `throw` dins d'`AppContent` → es veu
  l'`ErrorFallback` global.
