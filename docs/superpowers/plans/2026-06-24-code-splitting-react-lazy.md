# Code-splitting: React.lazy + Suspense per a panells i FloorView3D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir els panells de Dockview i `FloorView3D` a càrrega lazy per reduir el bundle inicial.

**Architecture:** `registry.ts` deixa d'importar els panells estàticament i passa a usar `React.lazy()` per a cada component. `PANEL_COMPONENTS` es construeix igual que ara però amb les versions lazy. `DockviewShell` embolcalla el renderitzat dels panells amb `<Suspense>`. `FloorView3D` es fa lazy dins de `FloorPanel`, embolcallat amb `<Suspense>`.

**Tech Stack:** React 19, TypeScript 6, Vite 8. Sense cap nova dependència.

## Global Constraints

- React ^19.2.6 — `lazy()` i `Suspense` són estàbles, no cal cap import especial.
- No afegir dependències noves al `package.json`.
- Mantenir exactament la mateixa API pública de `registry.ts` (`PANEL_COMPONENTS`, `PANEL_DEFINITIONS`, `getPanelDefinition`, `PanelType`).
- `PANEL_DEFINITIONS` ha de conservar el camp `component` — ara serà el component lazy en lloc del directe (el tipus canvia a `LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>`).
- El fallback de `Suspense` ha de ser consistent amb l'estil existent (`panel-state panel-state--muted`).
- Cap canvi a `DockviewShell.tsx` excepte afegir `<Suspense>` on calgui (veure Task 2).

---

## File Structure

| Fitxer | Canvi |
|---|---|
| `src/panels/registry.ts` | Substituir imports estàtics per `React.lazy()`. Ajustar tipus. |
| `src/panels/FloorPanel.tsx` | Fer `FloorView3D` lazy amb `<Suspense>` local. |
| `src/components/PanelSuspenseFallback.tsx` | Nou component: fallback reutilitzable per a panells. |

---

## Task 1: Fallback reutilitzable per a Suspense de panells

**Files:**
- Create: `src/components/PanelSuspenseFallback.tsx`

**Interfaces:**
- Produces: `export function PanelSuspenseFallback(): JSX.Element` — component sense props que renderitza l'indicador de càrrega.

- [ ] **Step 1: Crear el component**

```tsx
// src/components/PanelSuspenseFallback.tsx
export function PanelSuspenseFallback() {
  return <p className="panel-state panel-state--muted">Carregant…</p>
}
```

- [ ] **Step 2: Verificar que compila sense errors**

```bash
npx tsc -b --noEmit
```

Expected: cap error de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelSuspenseFallback.tsx
git commit -m "feat(code-splitting): add PanelSuspenseFallback for Suspense fallbacks"
```

---

## Task 2: Convertir els panells del registry a React.lazy

Aquesta és la tasca central. `registry.ts` substitueix els 8 imports estàtics de panells per `React.lazy()`. `PANEL_DEFINITIONS` actualitza el tipus de `component`. `PANEL_COMPONENTS` s'envolta en `<Suspense>` dins de `withPanelErrorBoundary`.

**Files:**
- Modify: `src/panels/registry.ts`

**Interfaces:**
- Consumes: `PanelSuspenseFallback` de `../components/PanelSuspenseFallback`
- Produces: mateixa API — `PANEL_COMPONENTS`, `PANEL_DEFINITIONS`, `getPanelDefinition`, `PanelType` sense canvis de signatura externes visibles per a `DockviewShell`.

- [ ] **Step 1: Substituir el contingut de `registry.ts`**

```ts
import { createElement, lazy, Suspense, type FunctionComponent, type LazyExoticComponent } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { SfIconName } from '../components/ds/SfIcon'
import { ErrorBoundary } from '../components/error/ErrorBoundary'
import { PanelErrorFallback } from '../components/error/PanelErrorFallback'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'

export type PanelType =
  | 'home'
  | 'insights'
  | 'agents'
  | 'queues'
  | 'skills'
  | 'work'
  | 'floor'
  | 'floorEditor'

export interface PanelDefinition {
  type: PanelType
  title: string
  iconName: SfIconName
  component: LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { type: 'home',        title: 'Home',         iconName: 'home',        component: lazy(() => import('./HomePanel').then(m => ({ default: m.HomePanel }))) },
  { type: 'insights',   title: 'Insights',     iconName: 'insights',   component: lazy(() => import('./InsightsPanel').then(m => ({ default: m.InsightsPanel }))) },
  { type: 'agents',     title: 'Agents',       iconName: 'agent',      component: lazy(() => import('./AgentsPanel').then(m => ({ default: m.AgentsPanel }))) },
  { type: 'queues',     title: 'Queues',       iconName: 'queue',      component: lazy(() => import('./QueuesPanel').then(m => ({ default: m.QueuesPanel }))) },
  { type: 'skills',     title: 'Skills',       iconName: 'skill',      component: lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel }))) },
  { type: 'work',       title: 'Work',         iconName: 'work',       component: lazy(() => import('./WorkPanel').then(m => ({ default: m.WorkPanel }))) },
  { type: 'floor',      title: 'Floor',        iconName: 'floor',      component: lazy(() => import('./FloorPanel').then(m => ({ default: m.FloorPanel }))) },
  { type: 'floorEditor', title: 'Floor editor', iconName: 'floorEditor', component: lazy(() => import('./FloorEditorPanel').then(m => ({ default: m.FloorEditorPanel }))) },
]

function withPanelErrorBoundary(
  PanelComponent: LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>,
): FunctionComponent<IDockviewPanelProps> {
  const Wrapped: FunctionComponent<IDockviewPanelProps> = (props) =>
    createElement(Suspense, {
      fallback: createElement(PanelSuspenseFallback),
      children: createElement(ErrorBoundary, {
        fallback: (error, reset) => createElement(PanelErrorFallback, { error, reset }),
        children: createElement(PanelComponent, props),
      }),
    })
  Wrapped.displayName = `PanelLazy(${PanelComponent.displayName ?? 'Panel'})`
  return Wrapped
}

export const PANEL_COMPONENTS = Object.fromEntries(
  PANEL_DEFINITIONS.map((panel) => [panel.type, withPanelErrorBoundary(panel.component)]),
) as Record<PanelType, FunctionComponent<IDockviewPanelProps>>

export function getPanelDefinition(type: PanelType): PanelDefinition {
  const panel = PANEL_DEFINITIONS.find((item) => item.type === type)
  if (!panel) {
    throw new Error(`Unknown panel type: ${type}`)
  }
  return panel
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc -b --noEmit
```

Expected: cap error de TypeScript. Si hi ha errors de tipus relacionats amb `LazyExoticComponent` vs `FunctionComponent`, és perquè algun lloc del codi importa `PanelDefinition.component` amb el tipus antic — corregir-ho en aquell fitxer.

- [ ] **Step 3: Verificar que el linter no reporta errors**

```bash
npm run lint
```

Expected: cap error ni warning nou.

- [ ] **Step 4: Arrencar l'app i verificar que els panells carreguen**

```bash
npm run dev:mock
```

Obrir http://localhost:5173, obrir cada panell des del menú i confirmar que:
- S'apareix breument el text "Carregant…" en panells lents (opcional, pot ser massa ràpid per veure'l).
- Tots els panells renderitzen correctament sense errors de consola.

- [ ] **Step 5: Commit**

```bash
git add src/panels/registry.ts src/components/PanelSuspenseFallback.tsx
git commit -m "feat(code-splitting): lazy-load all panels via React.lazy + Suspense"
```

---

## Task 3: Fer FloorView3D lazy dins de FloorPanel

`FloorView3D` pesa ~400 línies i usa Three.js-style canvas SVG. Es carrega sempre tot i que l'usuari pot no obrir mai la vista 3D. Es fa lazy i s'embolcalla amb `<Suspense>` dins del propi `FloorPanel`.

**Files:**
- Modify: `src/panels/FloorPanel.tsx`

**Interfaces:**
- Consumes: `PanelSuspenseFallback` de `../components/PanelSuspenseFallback`
- La prop API de `FloorView3D` no canvia — segueix rebent `{ floor, agentsById, dir, seatStyle, showAvatars, animations, onSelectAgent }`.

- [ ] **Step 1: Afegir el lazy import i Suspense a `FloorPanel.tsx`**

Substituir la línia d'import de `FloorView3D`:
```ts
// Abans:
import { FloorView3D, type SeatStyle } from '../components/floor/FloorView3D'
```

Per:
```ts
import { lazy, Suspense } from 'react'
import type { SeatStyle } from '../components/floor/FloorView3D'
import { PanelSuspenseFallback } from '../components/PanelSuspenseFallback'

const FloorView3D = lazy(() =>
  import('../components/floor/FloorView3D').then(m => ({ default: m.FloorView3D }))
)
```

I a la línia d'import de React, afegir `lazy` i `Suspense` als imports existents (o crear-los si no existien):
```ts
// Abans:
import { useEffect, useMemo, useState } from 'react'
// Després:
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
```

- [ ] **Step 2: Embolcallar `<FloorView3D>` amb `<Suspense>` al JSX**

Localitzar el fragment on es renderitza `<FloorView3D>` (a la secció `view === '3d'`, dins de `<div className="fv-canvas">`):

```tsx
// Abans:
{view === '3d' ? (
  <FloorView3D
    floor={activeFloor}
    agentsById={agentsById}
    dir={dir}
    seatStyle={seatStyle}
    showAvatars={prefs.showAvatars}
    animations={prefs.animations}
    onSelectAgent={handleSelectAgent}
  />
) : (
  <FloorView ... />
)}

// Després:
{view === '3d' ? (
  <Suspense fallback={<PanelSuspenseFallback />}>
    <FloorView3D
      floor={activeFloor}
      agentsById={agentsById}
      dir={dir}
      seatStyle={seatStyle}
      showAvatars={prefs.showAvatars}
      animations={prefs.animations}
      onSelectAgent={handleSelectAgent}
    />
  </Suspense>
) : (
  <FloorView ... />
)}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc -b --noEmit
```

Expected: cap error. Si TypeScript es queixa de que `FloorView3D` lazy no és assignable on s'esperava `FunctionComponent`, és correcte — `lazy()` retorna `LazyExoticComponent` que és compatible amb JSX directament però no amb el tipus `FunctionComponent`. En aquest cas no cal fer res, el JSX funcionarà igualment.

- [ ] **Step 4: Arrencar l'app i provar la vista 3D**

```bash
npm run dev:mock
```

- Obrir el panell **Floor**.
- Canviar a vista **3D**.
- Confirmar que la vista 3D es renderitza correctament.
- Confirmar que no hi ha errors a la consola del navegador.

- [ ] **Step 5: Commit**

```bash
git add src/panels/FloorPanel.tsx
git commit -m "feat(code-splitting): lazy-load FloorView3D within FloorPanel"
```

---

## Self-Review

**Cobertura de la issue #15:**
- ✅ Panells (`HomePanel`, `InsightsPanel`, `AgentsPanel`, `QueuesPanel`, `SkillsPanel`, `WorkPanel`, `FloorPanel`, `FloorEditorPanel`) → `React.lazy()` a Task 2.
- ✅ `FloorView3D` → `React.lazy()` a Task 3.
- ✅ `DockviewShell` — `PANEL_COMPONENTS` continua funcionant sense canvis al fitxer shell. El `Suspense` s'afegeix dins de `withPanelErrorBoundary` al registry.
- ✅ Fallback consistent amb l'estil existent (`panel-state panel-state--muted`).

**Placeholders:** cap.

**Consistència de tipus:**
- `PanelDefinition.component` és ara `LazyExoticComponent<FunctionComponent<IDockviewPanelProps>>` a Task 2.
- `withPanelErrorBoundary` accepta `LazyExoticComponent<...>` a Task 2.
- Task 3 usa `lazy()` directament en JSX — no passa per `PanelDefinition`.
