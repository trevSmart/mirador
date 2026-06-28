# Botó de refrescar amb text "fa X" de l'últim refresc exitós

## Objectiu

El botó de refrescar del header ha de mostrar, com a label al costat de la
icona, quant fa de l'últim refresc exitós de les dades (snapshot). El text és
relatiu i s'auto-actualitza en pantalla.

## Comportament

- **Format**: relatiu — `"fa 5 s"`, `"fa 2 min"`, `"fa 1 h"`.
- **Ubicació**: label dins del mateix `<button>` de refrescar, al costat de la icona.
- **Estat inicial** (abans del primer refresc exitós): només la icona, sense text.
- **Auto-actualització**: el text es recalcula en pantalla cada 20 s mitjançant
  un tick d'estat que força re-render. No torna a demanar dades.
- **Mentre refresca** (`isRefreshing`): la icona gira; el text manté l'últim
  valor conegut (no es buida).

## Canvis tècnics

### 1. `src/api/data-hooks.ts`
- `useDataStatus` exposa `dataUpdatedAt: number` (de `query.dataUpdatedAt` de
  TanStack Query; `0` si encara no hi ha hagut cap fetch exitós).
- Afegir `dataUpdatedAt` al tipus `DataStatus` i a `notifyOnChangeProps`.

### 2. `src/utils/relative-time.ts` (nou)
- Funció pura `formatRelativeTime(fromMs: number, nowMs: number): string`.
- Llindars: `< 60 s` → `"fa N s"`; `< 60 min` → `"fa N min"`; en endavant → `"fa N h"`.
- Pura i testejable (rep `nowMs` per injecció, sense `Date.now()` intern).

### 3. `src/components/AppHeader.tsx`
- Consumir `dataUpdatedAt` de `useDataStatus`.
- `useEffect` amb `setInterval(20_000)` que incrementa un tick d'estat per
  forçar re-render; neteja l'interval en desmuntar.
- Renderitzar el text (`<span>`) dins del `<button>` només si `dataUpdatedAt > 0`.
- Actualitzar `title`/`aria-label` perquè incloguin la mateixa informació.

### 4. `src/index.css`
- Variant del botó (p. ex. `.app-header__button--with-label`) o ajust de
  `.app-header__button--icon` per admetre icona + text (gap, padding).

## Casos límit

- `dataUpdatedAt === 0` → sense text.
- Interval netejat en desmuntar.
- El tick i el càlcul són barats (una resta + format); cap fetch implicat.

## Tests

- `formatRelativeTime` cobreix els tres trams (s / min / h) i les fronteres
  (59 s, 60 s, 59 min, 60 min).
