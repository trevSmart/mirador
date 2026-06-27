# Dreceres de teclat globals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afegir un sistema de dreceres de teclat globals que funcionin des de qualsevol tab, amb un únic listener i una taula declarativa de dreceres; la primera drecera és `S` per obrir Settings, bloquejada si hi ha qualsevol modal obert.

**Architecture:** Dos mòduls nous seguint el patró Context API del projecte (provider `.tsx` + context/hook `.ts`). Un *modal registry* (`src/modals/`) és la font única de veritat de "hi ha algun overlay obert". Un *sistema de shortcuts* (`src/shortcuts/`) té l'únic `addEventListener('keydown')` global, recorre una taula declarativa i executa accions comprovant condicions (camp de text, modal obert, modificadors).

**Tech Stack:** React 19 + TypeScript, Vite, React Context API. Sense Zustand/Redux. Logs via `devLog` (`src/dev/dev-log.ts`).

## Global Constraints

- **Sense framework de tests al projecte.** No hi ha vitest/jest. La verificació de cada tasca és: `npm run lint` (eslint) i `npm run build` (`tsc -b && vite build`, fa el typecheck) en verd, més verificació manual descrita a la tasca. No escriguis tests unitaris ni instal·lis cap test runner.
- **Patró Context API obligatori:** el component provider viu en un fitxer `.tsx` que NOMÉS exporta el provider (per Fast Refresh); el `createContext` + hook + tipus viuen en un fitxer `.ts` separat. Mira `src/settings/SettingsModalProvider.tsx` + `src/settings/settings-modal-context.ts` com a referència exacta.
- **Logs:** fer servir `devLog.action(label, detail?)` de `src/dev/dev-log.ts` per a accions; per a errors, `console.error(...)` (devLog l'intercepta com a nivell `error`).
- **Idioma:** comentaris i textos en català, com la resta del codebase.

---

### Task 1: Modal registry (context + hook + provider)

Crea la font única de veritat sobre si hi ha algun overlay obert.

**Files:**
- Create: `src/modals/modal-registry-context.ts`
- Create: `src/modals/ModalRegistryProvider.tsx`
- Create: `src/modals/useRegisterModal.ts`

**Interfaces:**
- Consumes: res (primera tasca).
- Produces:
  - `ModalRegistryContextValue` amb `isAnyModalOpen: () => boolean` i `setModalState: (id: string, isOpen: boolean) => void`.
  - `useModalRegistry(): ModalRegistryContextValue`.
  - `ModalRegistryProvider({ children }: { children: ReactNode })`.
  - `useRegisterModal(id: string, isOpen: boolean): void`.

- [ ] **Step 1: Crear el context i el hook**

Crea `src/modals/modal-registry-context.ts`:

```ts
/* Modal registry — context + hook (sense components, perquè Fast Refresh
   estigui content). El <ModalRegistryProvider> viu a ModalRegistryProvider.tsx
   i subministra el valor d'aquest context.

   És la font única de veritat sobre si hi ha algun overlay obert (settings,
   detail drawer, dev console). Les dreceres globals la consulten per decidir
   si actuen. */

import { createContext, useContext } from 'react'

export interface ModalRegistryContextValue {
  /** Cert si almenys un modal/overlay registrat està obert ara mateix. */
  isAnyModalOpen: () => boolean
  /** Cada overlay informa del seu estat (normalment via useRegisterModal). */
  setModalState: (id: string, isOpen: boolean) => void
}

export const ModalRegistryContext = createContext<ModalRegistryContextValue | null>(null)

export function useModalRegistry(): ModalRegistryContextValue {
  const ctx = useContext(ModalRegistryContext)
  if (!ctx) {
    throw new Error('useModalRegistry must be used within ModalRegistryProvider')
  }
  return ctx
}
```

- [ ] **Step 2: Crear el provider**

Crea `src/modals/ModalRegistryProvider.tsx`:

```tsx
/* ModalRegistryProvider — l'únic export és el component, així Fast Refresh
   funciona. Context + tipus + hook viuen a ./modal-registry-context. */

import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import {
  ModalRegistryContext,
  type ModalRegistryContextValue,
} from './modal-registry-context'

export function ModalRegistryProvider({ children }: { children: ReactNode }) {
  /* useRef en lloc de state: no necessitem re-renderitzar quan un modal
     s'obre/tanca; només llegim el conjunt en el moment d'una pulsació. */
  const openIds = useRef<Set<string>>(new Set())

  const isAnyModalOpen = useCallback(() => openIds.current.size > 0, [])

  const setModalState = useCallback((id: string, isOpen: boolean) => {
    if (isOpen) {
      openIds.current.add(id)
    } else {
      openIds.current.delete(id)
    }
  }, [])

  const value = useMemo<ModalRegistryContextValue>(
    () => ({ isAnyModalOpen, setModalState }),
    [isAnyModalOpen, setModalState],
  )

  return (
    <ModalRegistryContext.Provider value={value}>
      {children}
    </ModalRegistryContext.Provider>
  )
}
```

- [ ] **Step 3: Crear el hook auxiliar useRegisterModal**

Crea `src/modals/useRegisterModal.ts`:

```ts
/* useRegisterModal — perquè cada overlay informi del seu estat al registre
   amb una sola línia. Sincronitza isOpen amb el registre i neteja en desmuntar. */

import { useEffect } from 'react'
import { useModalRegistry } from './modal-registry-context'

export function useRegisterModal(id: string, isOpen: boolean): void {
  const { setModalState } = useModalRegistry()
  useEffect(() => {
    setModalState(id, isOpen)
    return () => setModalState(id, false)
  }, [id, isOpen, setModalState])
}
```

- [ ] **Step 4: Verificar lint i typecheck**

Run: `npm run lint && npm run build`
Expected: PASS (sense errors). Encara no s'usa enlloc, però ha de compilar i passar eslint.

- [ ] **Step 5: Commit**

```bash
git add src/modals/
git commit -m "feat: add modal registry as single source of truth for open overlays

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Registrar els overlays existents al registre

Fes que els tres overlays informin el seu estat al registre. El `ModalRegistryProvider` encara no està al tree (es cablarà a la Task 4 junt amb shortcuts), però aquests `useRegisterModal` necessiten estar dins seu — per això la Task 4 col·loca el provider per sobre dels punts on es renderitzen. Aquesta tasca afegeix les crides; quedaran efectives quan la Task 4 munti el provider.

> Nota d'ordre d'execució: si executes les tasques en ordre, després de la Task 2 l'app encara NO té `ModalRegistryProvider` muntat, així que `useRegisterModal` (que crida `useModalRegistry`) llançaria. Per evitar una app trencada entremig, **fes les Tasks 2 i 4 com una unitat**: aplica els canvis de la Task 2, després els de la Task 4, i verifica/commiteja un cop. Les dues estan dissenyades per anar juntes.

**Files:**
- Modify: `src/settings/SettingsModalProvider.tsx`
- Modify: `src/detail/DetailDrawerContext.tsx`
- Modify: `src/dev/DevConsoleContext.tsx`

**Interfaces:**
- Consumes: `useRegisterModal(id, isOpen)` de la Task 1.
- Produces: els tres overlays registren els IDs `'settings'`, `'detail-drawer'`, `'dev-console'`.

- [ ] **Step 1: Registrar el settings modal**

A `src/settings/SettingsModalProvider.tsx`, afegeix l'import i la crida dins el provider (després de l'`useState` de `isOpen`).

Afegeix a la zona d'imports:

```ts
import { useRegisterModal } from '../modals/useRegisterModal'
```

Dins `SettingsModalProvider`, just després de la línia `const [initialSection, setInitialSection] = useState<SettingsSectionId>('aparenca')`:

```ts
  useRegisterModal('settings', isOpen)
```

- [ ] **Step 2: Registrar el detail drawer**

A `src/detail/DetailDrawerContext.tsx`, el drawer està obert quan `detail !== null`.

Afegeix a la zona d'imports:

```ts
import { useRegisterModal } from '../modals/useRegisterModal'
```

Dins `DetailDrawerProvider`, just després de `const [detail, setDetail] = useState<DetailTarget | null>(null)`:

```ts
  useRegisterModal('detail-drawer', detail !== null)
```

- [ ] **Step 3: Registrar la dev console**

A `src/dev/DevConsoleContext.tsx`, la console està oberta quan `visible === true`.

Afegeix a la zona d'imports:

```ts
import { useRegisterModal } from '../modals/useRegisterModal'
```

Dins `DevConsoleProvider`, just després de la línia `const [search, setSearchState] = useState('')`:

```ts
  useRegisterModal('dev-console', visible)
```

- [ ] **Step 4: (Verificació diferida)**

No verifiquis ni commitis encara — continua amb la Task 3 i la Task 4. La verificació es fa al final de la Task 4 (lint + build + manual), quan el provider ja està muntat. Sense això l'app llançaria perquè `useModalRegistry` no trobaria el provider.

---

### Task 3: Sistema de shortcuts (tipus, taula, provider)

Crea l'únic listener de teclat global i la taula declarativa de dreceres.

**Files:**
- Create: `src/shortcuts/shortcut-types.ts`
- Create: `src/shortcuts/shortcuts.ts`
- Create: `src/shortcuts/GlobalShortcutsProvider.tsx`

**Interfaces:**
- Consumes: `useModalRegistry()` de la Task 1; `useSettingsModal()` de `src/settings/settings-modal-context.ts` (mètode `open(section?)`).
- Produces:
  - `ShortcutContext` (objecte d'accions injectades): `{ openSettings: () => void }`.
  - `Shortcut` interface: `{ id, key, allowInModal?, allowInTextField?, run }`.
  - `SHORTCUTS: Shortcut[]`.
  - `GlobalShortcutsProvider({ children }: { children: ReactNode })`.

- [ ] **Step 1: Crear els tipus**

Crea `src/shortcuts/shortcut-types.ts`:

```ts
/* Tipus del sistema de dreceres de teclat globals. */

/** Accions que el provider injecta a cada drecera quan s'executa.
    Afegeix-hi camps a mesura que noves dreceres necessitin noves accions. */
export interface ShortcutContext {
  openSettings: () => void
}

export interface Shortcut {
  /** Identificador estable, per a logs i depuració. */
  id: string
  /** Tecla en minúscula, comparada contra event.key.toLowerCase() (ex: 's'). */
  key: string
  /** Si cert, la drecera funciona encara que hi hagi un modal obert. Default: false. */
  allowInModal?: boolean
  /** Si cert, la drecera funciona encara que el focus sigui en un camp de text. Default: false. */
  allowInTextField?: boolean
  /** Acció a executar. */
  run: (ctx: ShortcutContext) => void
}
```

- [ ] **Step 2: Crear la taula de dreceres**

Crea `src/shortcuts/shortcuts.ts`:

```ts
/* Taula declarativa de dreceres de teclat globals.
   AFEGIR UNA DRECERA NOVA = afegir una entrada aquí. El listener únic viu a
   GlobalShortcutsProvider.tsx i no s'ha de tocar per afegir dreceres. */

import type { Shortcut } from './shortcut-types'

export const SHORTCUTS: Shortcut[] = [
  {
    id: 'open-settings',
    key: 's',
    run: (ctx) => ctx.openSettings(),
  },
]
```

- [ ] **Step 3: Crear el provider amb l'únic listener**

Crea `src/shortcuts/GlobalShortcutsProvider.tsx`:

```tsx
/* GlobalShortcutsProvider — l'ÚNIC addEventListener('keydown') global per a
   dreceres d'app. Recorre SHORTCUTS, comprova condicions (modificadors, camp
   de text, modal obert) i executa l'acció. No renderitza res visible.

   Ha d'anar prou avall a l'arbre per accedir als hooks d'acció (useSettingsModal)
   i al registre de modals (useModalRegistry). */

import { useEffect, useMemo, type ReactNode } from 'react'
import { devLog } from '../dev/dev-log'
import { useModalRegistry } from '../modals/modal-registry-context'
import { useSettingsModal } from '../settings/settings-modal-context'
import { SHORTCUTS } from './shortcuts'
import type { ShortcutContext } from './shortcut-types'

/** Cert si el focus actual és en un camp on l'usuari escriu text. */
function isEditingTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

export function GlobalShortcutsProvider({ children }: { children: ReactNode }) {
  const { isAnyModalOpen } = useModalRegistry()
  const { open: openSettings } = useSettingsModal()

  const shortcutCtx = useMemo<ShortcutContext>(
    () => ({ openSettings: () => openSettings() }),
    [openSettings],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      /* Ignora combinacions amb modificadors per no xocar amb dreceres
         del sistema/navegador. */
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      const shortcut = SHORTCUTS.find((s) => s.key === key)
      if (!shortcut) return

      if (!shortcut.allowInTextField && isEditingTextField()) return
      if (!shortcut.allowInModal && isAnyModalOpen()) return

      event.preventDefault()
      try {
        devLog.action('shortcut:run', shortcut.id)
        shortcut.run(shortcutCtx)
      } catch (err) {
        console.error(`Shortcut "${shortcut.id}" failed`, err)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAnyModalOpen, shortcutCtx])

  return <>{children}</>
}
```

- [ ] **Step 4: Verificar lint i typecheck**

Run: `npm run lint && npm run build`
Expected: PASS. (Encara no està al tree; només compila.)

- [ ] **Step 5: Commit**

```bash
git add src/shortcuts/
git commit -m "feat: add global keyboard shortcuts system with single listener

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Cablar els providers a App.tsx i verificar end-to-end

Munta `ModalRegistryProvider` i `GlobalShortcutsProvider` a l'arbre amb l'ordre correcte (registre per fora dels overlays; shortcuts per dins, amb accés a `useSettingsModal`).

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ModalRegistryProvider` (Task 1), `GlobalShortcutsProvider` (Task 3), i els `useRegisterModal` afegits a la Task 2.
- Produces: app amb dreceres globals actives.

- [ ] **Step 1: Afegir els imports a App.tsx**

A `src/App.tsx`, afegeix a la zona d'imports:

```ts
import { ModalRegistryProvider } from './modals/ModalRegistryProvider'
import { GlobalShortcutsProvider } from './shortcuts/GlobalShortcutsProvider'
```

- [ ] **Step 2: Embolcallar AppContent amb els nous providers**

A `src/App.tsx`, dins `App`, substitueix aquest bloc:

```tsx
                    <DevConsoleProvider>
                      <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
                        <AppContent />
                      </ErrorBoundary>
                    </DevConsoleProvider>
```

per aquest:

```tsx
                    <DevConsoleProvider>
                      <ModalRegistryProvider>
                        <GlobalShortcutsProvider>
                          <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
                            <AppContent />
                          </ErrorBoundary>
                        </GlobalShortcutsProvider>
                      </ModalRegistryProvider>
                    </DevConsoleProvider>
```

Raonament de l'ordre: `ModalRegistryProvider` ha d'estar per sobre d'`AppContent` (on viuen `<DetailDrawer>`, `<SettingsModal>`, `<DevConsole>`) perquè els seus `useRegisterModal` el trobin. Els tres provider d'estat dels overlays (`DetailDrawerProvider`, `SettingsModalProvider`, `DevConsoleProvider`) també queden per sobre del registre, així que els seus `useRegisterModal` (que s'executen dins aquests providers) hi tenen accés. `GlobalShortcutsProvider` queda dins de `SettingsModalProvider` per poder cridar `useSettingsModal`.

- [ ] **Step 3: Verificar lint i typecheck**

Run: `npm run lint && npm run build`
Expected: PASS sense errors.

- [ ] **Step 4: Verificació manual**

Run: `npm run dev` (o `npm run dev:mock`) i obre l'app al navegador.

Comprova:
1. Des de qualsevol tab, prémer `S` (sense res obert) → s'obre el modal de Settings.
2. Amb el modal de Settings obert, prémer `S` → no fa res nou (no es reobre ni hi ha error a consola).
3. Obre el detail drawer (clica un agent/cua) i prémer `S` → no obre Settings.
4. Posa el focus a la cerca global (o qualsevol input) i prémer `S` → escriu la lletra, NO obre Settings.
5. Prémer `Cmd+S` / `Ctrl+S` → comportament del navegador, no obre Settings.
6. Tanca tots els overlays i torna a provar `S` → torna a obrir Settings.

- [ ] **Step 5: Commit (inclou els canvis de la Task 2)**

```bash
git add src/App.tsx src/settings/SettingsModalProvider.tsx src/detail/DetailDrawerContext.tsx src/dev/DevConsoleContext.tsx
git commit -m "feat: wire global shortcuts + register overlays in modal registry

S obre Settings des de qualsevol tab quan no hi ha cap modal obert.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Cobertura del spec:** modal registry (Task 1) ✓; integració overlays (Task 2) ✓; sistema shortcuts extensible amb taula + únic listener (Task 3) ✓; ubicació providers + condicions (camp de text, modificadors, modal obert) + error handling try/catch (Task 3) ✓; drecera S → openSettings (Task 3, taula) ✓; verificació (Task 4, manual + lint/build, ja que no hi ha test runner) ✓.
- **Consistència de tipus:** `isAnyModalOpen`/`setModalState` idèntics entre context (Task 1), provider (Task 1) i consumidors (Tasks 2-3). `ShortcutContext.openSettings` definit a Task 3 i usat a la taula i al provider igual.
- **Sense placeholders:** tot el codi és complet i literal.
- **Ordre d'execució:** Tasks 2 i 4 marcades explícitament com a unitat per no deixar l'app trencada entre commits (el registre s'usa abans d'estar muntat altrament).
