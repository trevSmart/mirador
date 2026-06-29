# Drecera Cmd/Ctrl+Z d'undo al floor editor — Disseny

**Data:** 2026-06-30
**Estat:** Aprovat per implementar

## Objectiu

Permetre **Cmd/Ctrl+Z → desfer** i **Cmd/Ctrl+Shift+Z → refer** sobre la pila d'accions del floor editor (Space Editor), funcionant des de qualsevol lloc de l'app però **només actiu quan el panel de l'editor està muntat**.

## Context actual

- L'editor és [SpaceEditorPanel.tsx](../../../src/panels/SpaceEditorPanel.tsx). La pila d'accions viu dins el hook [useSpacePlan.ts](../../../src/space/useSpacePlan.ts), que exposa `undo()`, `redo()`, `canUndo`, `canRedo`. Els botons de la toolbar ja hi estan connectats.
- `useSpacePlan` és una **instància de hook local al panel**, no un store global. El `GlobalShortcutsProvider` viu molt amunt a l'arbre i no hi té accés directe.
- [GlobalShortcutsProvider.tsx](../../../src/shortcuts/GlobalShortcutsProvider.tsx) és l'únic `addEventListener('keydown')` global. Actualment **ignora qualsevol combinació amb `metaKey`/`ctrlKey`/`altKey`** (línia ~46), per no xocar amb dreceres del sistema.
- Ja existeix el patró de "registre via context amb `useRef` + hook auxiliar" del modal registry (`useRegisterModal`), que reutilitzem.

## Decisions de disseny

1. **Abast global** però condicionat a que l'editor estigui muntat (decisió de l'usuari).
2. **Camps de text:** quan el focus és en input/textarea/contenteditable, la drecera **no actua** i deixa passar l'undo natiu del navegador.
3. **Undo i Redo:** `Cmd/Ctrl+Z` desfà; `Cmd/Ctrl+Shift+Z` refà.
4. **No reescrivim `useSpacePlan` com a store global** (Patró B descartat per invasiu). Fem servir un registre lleuger via context (Patró A).
5. **`event.repeat`:** es permet (mantenir premut repeteix undo/redo, com fa el navegador).

## Arquitectura

Un mòdul nou seguint el patró Context API + `useRef` existent.

### Registre d'undo de l'editor — `src/shortcuts/editor-undo-context.tsx`

Font única de veritat sobre els handlers d'undo/redo actualment actius.

```ts
interface EditorUndoHandlers {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface EditorUndoRegistry {
  register: (handlers: EditorUndoHandlers | null) => void
  getHandlers: () => EditorUndoHandlers | null
}
```

- `EditorUndoProvider` guarda els handlers actius dins un `useRef` (evita re-renders; `getHandlers()` els llegeix en el moment de la pulsació).
- `useEditorUndoRegistry()` — hook per accedir al registre.
- `useRegisterEditorUndo(handlers)` — hook auxiliar: un `useEffect` que crida `register(handlers)` quan canvien, amb cleanup `register(null)` en desmuntar. Mirall de `useRegisterModal`.
- Quan no hi ha res registrat (`getHandlers()` retorna `null`), la drecera és no-op i **no fa `preventDefault`** → l'undo natiu del navegador segueix disponible.

### Integració a `SpaceEditorPanel`

Una línia: `useRegisterEditorUndo({ undo: fp.undo, redo: fp.redo, canUndo: fp.canUndo, canRedo: fp.canRedo })`.

### Branca a `GlobalShortcutsProvider`

Dins `onKeyDown`, **abans** del `return` que ignora modificadors, s'afegeix:

```
si (metaKey || ctrlKey) i !altKey i key === 'z':
    si isEditingTextField() → return (deixa passar l'undo natiu)
    handlers = getHandlers()
    si !handlers → return
    si shiftKey:
        si !handlers.canRedo → return
        preventDefault(); handlers.redo()
    altrament:
        si !handlers.canUndo → return
        preventDefault(); handlers.undo()
    return
```

Es manté el `try/catch`/log com a la resta de dreceres. La resta del listener (combinacions amb modificador → ignorades) queda intacta.

## Flux de dades

`SpaceEditorPanel` (instància de `useSpacePlan`) → `useRegisterEditorUndo` escriu al `useRef` del provider → el listener global de `GlobalShortcutsProvider` el llegeix en cada pulsació de Cmd/Ctrl+Z.

## Ubicació a l'arbre de providers ([App.tsx](../../../src/App.tsx))

`EditorUndoProvider` ha d'anar **per sobre** del `GlobalShortcutsProvider` (que el llegeix) i **per sobre** del `SpaceEditorPanel` (que s'hi registra) — és a dir, al costat del `ModalRegistryProvider`, embolcallant tant els shortcuts com el contingut de l'app.

## Casos límit

- **Panel desmuntat** → `getHandlers()` és `null`, la drecera no fa res ni bloqueja el navegador.
- **Camp de text actiu** (renombrant una planta) → undo natiu del text, no del plànol.
- **`!canUndo` / `!canRedo`** → no es fa `preventDefault`; el navegador rep la tecla normalment.
- **Cmd+Alt+Z** → no es tracta com a undo (es requereix `!altKey`).

## Error handling

- Un `undo()`/`redo()` que llanci es captura en `try/catch` al listener i es registra via el sistema de logs existent (`devLog`/`console.error`), sense trencar el listener.

## Testing

- Verificació manual: obrir el floor editor, pintar/esborrar cel·les, prémer Cmd/Ctrl+Z (undo) i Cmd/Ctrl+Shift+Z (redo); comprovar que coincideix amb els botons de la toolbar.
- Comprovar que escrivint en un camp de text (renom de planta) Cmd/Ctrl+Z fa undo del text, no del plànol.
- Comprovar que amb el panel tancat la drecera no interfereix.
- Tests unitaris si hi ha infraestructura: el registre reflecteix register/cleanup; el listener dispara undo/redo en el cas net i s'absté en camp de text / sense handlers.

## Fora d'abast (YAGNI)

- Undo/redo per a altres panells.
- Indicador visual addicional (els botons de toolbar ja reflecteixen `canUndo`/`canRedo`).
- Migrar `useSpacePlan` a un store global.
