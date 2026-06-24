# Rotació compartida del floor + canvas 50×50 — Disseny

**Data:** 2026-06-24
**Branca:** spectacular-beetle

## Objectiu

La rotació d'una planta (`dir`) ha de ser un **valor compartit desat al plànol**, que
tant l'editor com les vistes de visualització (Floor i Home) respectin, en **2D i 3D**.
Els botons de rotació es mouen **a l'editor**. La graella passa a ser **50×50** i el
render de les vistes mostra **només l'àrea real de la sala**, escalada per omplir el
contenidor.

## Decisions preses (brainstorming)

1. **Rotació per planta, desada al plànol** (no estat local ni global d'usuari).
2. **Botons de rotació només a l'editor** (FloorToolbar). El floor normal només llegeix.
3. **Graella 50×50**, s'oblida el límit anterior 23×16.
4. **Canvas quadrat conceptual de 50×50**: la sala viu en qualsevol part; en rotar 90°
   es transposa dins del quadrat (rotació pura, no desquadra).
5. **Dades existents descartables**: sense migració; en carregar una versió d'esquema
   anterior es descarta i es comença net.
6. **Render a Home/Floor**: calcular el bounding box de la sala **ja rotada** i
   renderitzar només aquesta àrea, **escalada per omplir el contenidor** (2D i 3D).
7. **Home** renderitza `<FloorPanel />`, així que hereta tot el comportament del Floor
   sense canvis propis.

## Arquitectura

### 1. Model de dades i graella

- `src/floor/floor-plan-model.ts`: `GRID_C = 50`, `GRID_R = 50`. Pujar
  `FLOOR_SCHEMA_VERSION` (1 → 2).
- `src/floor/types.ts`: `Floor` guanya `dir: Dir` (`0|1|2|3`). Es persisteix com
  qualsevol altra propietat del floor.
- Repositori (`src/floor/floor-plan-repository.ts`): en carregar, si `data.v` no és
  la versió actual, **descartar** i retornar un plànol nou per defecte (dades antigues
  descartables). Nous floors es creen amb `dir: 0`.

### 2. Funcions pures compartides (`src/floor/floor-iso.ts`)

```ts
// Rotació 90° d'una cel·la dins d'una graella quadrada N×N.
rotateCell(c, r, dir, N): [number, number]
//  dir 0: (c, r)
//  dir 1: (N-1-r, c)
//  dir 2: (N-1-c, N-1-r)
//  dir 3: (r, N-1-c)

// Bounding box de la sala JA rotada (cel·les + seients).
// Retorna { minC, minR, cols, rows } sobre coordenades rotades.
roomBounds(cells, seats, dir, N): { minC, minR, cols, rows }
```

Aquestes funcions són el nucli testejable; les vistes les consumeixen.

### 3. Rotació compartida (estat i flux)

- `src/floor/useFloorPlan.ts` (editor, mutable): nova acció
  `rotateFloor(delta: 1 | -1)` que fa `dir = (dir + delta + 4) % 4` sobre la planta
  activa, marca `dirty` i entra a l'**undo/redo** com qualsevol edició. S'exposa al panell.
- `src/floor/useFloorPlanData.ts` (vista normal, només lectura): cap canvi d'estat; les
  vistes llegeixen `activeFloor.dir` del plànol carregat. La sincronització
  editor→vista ja existeix (storage events / subscripció).
- El `[dir, setDir]` local de `FloorPanel.tsx` **desapareix**.

Flux: botó rotació (editor) → `rotateFloor(±1)` → muta `activeFloor.dir` → es desa →
editor i floor normal llegeixen aquell `dir` i el passen a 2D/3D.

### 4. Render enquadrat i escalat

Separació dades ↔ render:

- **Editor** (`FloorGrid.tsx`): graella **50×50** (mostra el quadrat sencer per poder
  col·locar la sala). Actualitzar `GRID_C/GRID_R` (ja importats), la detecció de clics i
  les dimensions del llenç a 50×50.
- **Vistes normals** (`FloorView.tsx` 2D, `FloorView3D.tsx` 3D): NO dibuixen el 50×50
  sencer. Flux:
  1. Aplicar `rotateCell` a cel·les/seients segons `dir`.
  2. Calcular el bbox del resultat (`roomBounds`).
  3. Renderitzar només el bbox, **escalat per omplir el contenidor**.

- `FloorView.tsx` (2D): rep `dir` com a prop; rota; enquadra al bbox rotat; mida de cel·la
  = `min(ampladaContenidor / cols, alçadaContenidor / rows)`; centra. Substitueix l'actual
  enquadrament retallat-sense-escalar.
- `FloorView3D.tsx` (3D): ja rota via `projectCell(dir)` i calcula bounds amb
  `computeIsoBounds`. Afegir escalat del SVG per omplir el contenidor (viewBox +
  `preserveAspectRatio="xMidYMid meet"` o wrapper que escali). Opera sobre l'espai 50×50 i
  el `dir` ve del plànol.

En rotar 90°, el bbox canvia d'orientació (sala ampla → alta) i l'escala s'ajusta al
contenidor: el comportament natural de mirar la sala des d'un altre costat.

### 5. Botons de rotació (només a l'editor)

- `FloorPanel.tsx`: treure els dos `<ButtonIcon>` de rotació, el `.fv-rotate` i el `dir`
  local. Llegir `activeFloor.dir` i passar-lo a les vistes.
- `FloorToolbar.tsx`: afegir dos `<ButtonIcon>` "Gira a l'esquerra"/"Gira a la dreta"
  (SVG Panorama `ROTATE_ICON_PATH`, ja existent) que criden `rotateFloor(-1)` /
  `rotateFloor(+1)`. `ButtonIcon` es reutilitza. `ROTATE_ICON_PATH` es mou a un lloc
  compartit del floor.

## Components afectats

- `src/floor/floor-plan-model.ts` — graella 50×50, versió d'esquema.
- `src/floor/types.ts` — `Floor.dir`.
- `src/floor/floor-iso.ts` — `rotateCell`, `roomBounds`.
- `src/floor/floor-plan-repository.ts` — descartar versió antiga.
- `src/floor/useFloorPlan.ts` — `rotateFloor` + undo/redo; nous floors `dir: 0`.
- `src/components/floor/FloorToolbar.tsx` — botons de rotació.
- `src/components/floor/FloorGrid.tsx` — graella 50×50.
- `src/components/floor/FloorView.tsx` — rep `dir`, rota, enquadra, escala.
- `src/components/floor/FloorView3D.tsx` — escalar SVG al contenidor.
- `src/panels/FloorPanel.tsx` — treure botons + `dir` local; llegir `activeFloor.dir`.
- `src/panels/FloorEditorPanel.tsx` — connectar `rotateFloor` a la toolbar.
- `src/index.css` — estils canvas/escalat; netejar `.fv-rotate` si queda orfe.
- **HomePanel.tsx** — cap canvi (renderitza `<FloorPanel />`, hereta el comportament).

## Testing / verificació

Aquest repo no té framework de test. Verificació via:
- `npm run build` (`tsc -b && vite build`) i `npm run lint` nets.
- Comprovació visual:
  - Editor: graella 50×50; girar amb els botons → la sala gira; undo/redo funciona; desar.
  - Floor i Home: la sala apareix rotada segons `dir`, enquadrada al seu bbox i escalada
    per omplir el contenidor (2D i 3D).
  - Canviar de planta manté el `dir` propi de cada planta.
  - El floor normal ja no té botons de rotació.

## Fora d'abast

- Rotació editable des del floor normal o Home (només lectura allà).
- Migració de dades antigues (descartables).
- Rotació de l'editor en si (l'editor mostra el quadrat 50×50 sense rotar; rota el `dir`
  desat, que afecta les vistes).
