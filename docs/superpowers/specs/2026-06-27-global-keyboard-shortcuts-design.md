# Dreceres de teclat globals — Disseny

**Data:** 2026-06-27
**Estat:** Aprovat per implementar

## Objectiu

Afegir dreceres de teclat globals a l'app que funcionin des de qualsevol tab/panel, amb el codi concentrat en un sol lloc clar (tant la definició de les dreceres com l'únic listener de teclat).

Primera drecera: **`S`** → obre el modal de Settings, però **només** quan no hi ha cap modal/overlay obert.

## Context actual

- Estat global via **React Context API pur** (sense Zustand/Redux), amb providers a l'arrel ([App.tsx](../../../src/App.tsx)).
- Tres overlays, cadascun amb el seu context + hook:
  - **SettingsModal** — `useSettingsModal()` (`open(section)` / `close()`), estat `isOpen`.
  - **DetailDrawer** — `useDetailDrawer()`.
  - **DevConsole** — `useDevConsole()`.
- **No hi ha** sistema centralitzat de shortcuts: cada component que necessita teclat fa el seu propi `useEffect` amb `document.addEventListener('keydown', ...)` (p. ex. Escape a SettingsModal, DetailDrawer, UserMenu, GlobalSearch).
- **No hi ha** font única de veritat sobre si "hi ha algun modal obert".

## Decisions de disseny

1. **Bloqueig de modal:** registre central de modals (no consultar overlays un per un).
2. **Abast:** sistema de shortcuts extensible des de l'inici (taula declarativa + un únic listener).
3. **Camps de text:** les dreceres de lletra simple s'ignoren quan el focus és en un input/textarea/contenteditable.

## Arquitectura

Dos mòduls nous, cadascun amb una responsabilitat única, seguint el patró Context API existent (provider + context + hook separats per a Fast Refresh).

### 1. Modal registry — `src/modals/`

Font única de veritat sobre si hi ha algun overlay obert.

- `modal-registry-context.ts` — context + hook `useModalRegistry()`.
- `ModalRegistryProvider.tsx` — manté el conjunt d'IDs de modals oberts i exposa l'API.
- `useRegisterModal(id, isOpen)` — hook auxiliar perquè cada overlay informi del seu estat amb un sol `useEffect`.

```ts
// modal-registry-context.ts
interface ModalRegistry {
  isAnyModalOpen: () => boolean
  setModalState: (id: string, isOpen: boolean) => void
}
```

- El provider guarda un `Set<string>` d'IDs oberts dins un `useRef` (evita re-renders innecessaris; `isAnyModalOpen()` el llegeix en el moment de la pulsació).
- `useRegisterModal(id, isOpen)`: `useEffect` que crida `setModalState(id, isOpen)` quan canvia `isOpen`, amb cleanup `setModalState(id, false)` en desmuntar.

**Integració amb overlays existents** (una línia cadascun, sense canviar comportament):
- SettingsModal → `useRegisterModal('settings', isOpen)`
- DetailDrawer → `useRegisterModal('detail-drawer', isOpen)`
- DevConsole → `useRegisterModal('dev-console', isOpen)`

### 2. Sistema de shortcuts globals — `src/shortcuts/`

L'únic lloc amb un `addEventListener('keydown')` global per a dreceres d'app.

- `shortcuts.ts` — taula declarativa de shortcuts. **Aquí s'afegeixen dreceres noves.**
- `GlobalShortcutsProvider.tsx` — un únic listener que recorre la taula, comprova condicions i executa l'acció.
- `shortcut-types.ts` (opcional) — tipus.

```ts
// shortcuts.ts
interface Shortcut {
  id: string
  key: string                  // ex: 's'
  allowInModal?: boolean       // default false → bloquejat si hi ha modal obert
  allowInTextField?: boolean   // default false → ignorat en camps de text
  run: (ctx: ShortcutContext) => void
}
```

- `ShortcutContext` injecta els hooks d'acció que les dreceres necessiten (p. ex. `openSettings`). El provider els obté via `useSettingsModal()` etc.
- Drecera S: `{ id: 'open-settings', key: 's', run: (ctx) => ctx.openSettings() }`.

## Flux de dades — pulsació de tecla

Un únic listener al `GlobalShortcutsProvider`:

1. Si hi ha **Cmd/Ctrl/Alt/Meta** premuts → ignora (per no xocar amb dreceres del sistema/navegador).
2. Busca a la taula un shortcut amb `key` coincident (normalitzant majúscules/minúscules).
3. Si el focus és en un **camp de text** i `!allowInTextField` → ignora.
4. Si `isAnyModalOpen()` i `!allowInModal` → ignora.
5. Altrament: `event.preventDefault()` i `run(ctx)`.

Detecció de camp de text: `document.activeElement` és `INPUT`, `TEXTAREA`, o té `isContentEditable === true`.

## Ubicació a l'arbre de providers ([App.tsx](../../../src/App.tsx))

Regla: **registre per fora** (perquè els overlays s'hi registrin), **shortcuts per dins** (amb accés als hooks d'acció com `useSettingsModal`).

```
ModalRegistryProvider          ← nou (envolta els overlays)
  DetailDrawerProvider
    SettingsModalProvider
      DevConsoleProvider
        GlobalShortcutsProvider  ← nou (dins dels providers d'acció)
          AppContent (header, panels, overlays)
```

`ModalRegistryProvider` ha d'anar **per sobre** dels providers d'overlay perquè
aquests criden `useRegisterModal` → `useModalRegistry` al seu body; si el
registry no és un avantpassat, l'app llança en runtime. `GlobalShortcutsProvider`
queda per dins de tots (necessita `useSettingsModal` i `useModalRegistry`).

## Error handling

- Un `run()` que llanci es captura en `try/catch` dins el listener i es registra via el sistema de logs existent, sense trencar el listener.
- IDs duplicats a la taula: el primer match guanya; cap validació en runtime.

## Testing

- Tests unitaris (si hi ha infraestructura al projecte — a confirmar):
  - `isAnyModalOpen()` reflecteix obrir/tancar modals.
  - El listener: ignora la S amb modal obert, en camp de text, o amb Cmd/Ctrl premut; la dispara en el cas net.
- Verificació manual: provar la S des de cada tab, amb i sense modal obert, i mentre s'escriu a la cerca global.

## Fora d'abast (YAGNI)

- Combinacions de tecles / chords (Cmd+K, etc.).
- UI de configuració de keybindings.
- Migrar els listeners d'Escape existents al nou sistema (poden conviure; es pot fer més endavant).
