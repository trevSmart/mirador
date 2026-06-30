# Disseny: nivell **Site** amb logo

**Data:** 2026-06-30
**Estat:** Aprovat per implementar

## Objectiu

Introduir una nova entitat **Site** com a nivell arrel de la jerarquia del space
editor, per sobre de `Place`. Un Site representa una seu / proveïdor de call
center (un edifici); els Places que conté són les plantes/llocs d'aquell edifici.

Cada Site té un **logo** (imatge) que es pot carregar des de la app, persisteix al
registre de l'objecte i es mostra al tree view del space editor.

A la UI el nivell es diu **"Site"** (es manté l'anglicisme).

## Decisions preses

- **Jerarquia:** `Site → Place → Space` (nou nivell arrel complet, no un Site
  implícit).
- **Emmagatzematge del logo:** data-URL **base64** dins del propi `SpacePlanData`,
  al camp `image` del Site. Sense infraestructura d'upload nova (l'app no en té
  cap avui). El mapeig real a un camp Long Text de Salesforce és server-side i
  queda **fora d'abast** d'aquest canvi: l'app només envia/rep el JSON de
  `/space-plan`.
- **Export/Import:** passen a cobrir tota l'estructura (sites + logos), no només
  places.
- **Schema version:** `SPACE_SCHEMA_VERSION` puja de **2 → 3**. Els plans v2 vells
  es descarten en carregar (patró ja existent: `sanitizeSpacePlan` retorna `null`
  quan la versió no coincideix) i es recrea el `defaultSpacePlan`.

## Model de dades — `src/space/types.ts`

`Place` i `Space` no canvien. S'afegeix `Site` i es reescriu `SpacePlanData`:

```ts
export interface Site {
  id: string
  name: string
  /** Logo com a data-URL base64 (p.ex. "data:image/png;base64,…"), o null. */
  image: string | null
  places: Place[]
}

export interface SpacePlanData {
  /** Schema version, for forward-compatible migrations. */
  v: number
  activeSiteId: string | null
  activePlaceId: string | null
  sites: Site[]            // abans: places: Place[]
}
```

## Lògica de model — `src/space/space-plan-model.ts`

- `SPACE_SCHEMA_VERSION = 3`.
- **`sanitizeImage(value): string | null`** (nova): accepta només strings amb
  prefix `data:image/(png|jpeg|jpg|webp|svg+xml);base64,` i longitud per sota d'un
  límit (`LOGO_MAX_CHARS`, p.ex. ~150_000). Qualsevol altra cosa → `null`.
- **`sanitizeSpacePlan`** reescrit per recórrer `sites[] → places[] → spaces[]`:
  - Descarta sites sense cap place vàlid (igual que avui es descarten places sense
    spaces).
  - Cada site sanititza `id`, `name` (trim, max 40, fallback `'Site'`), `image`
    via `sanitizeImage`, i `places`.
  - `activeSiteId` / `activePlaceId` es validen contra els sites/places resultants,
    amb fallback al primer disponible.
  - Si no queda cap site usable → `null`.
- **`defaultSpacePlan`** embolcalla el Place per defecte dins d'un Site:
  `{ id, name: 'Site 1', image: null, places: [placePerDefecte] }`.
- **`prepareImported`** (substitueix/amplia `prepareImportedPlaces`): valida un pla
  importat i recrea **sites** complets amb ids nous (sites, places i spaces tots
  amb id fresc), de-duplicant noms de site contra els existents. Additiu: mai
  sobreescriu res. Es conserva el logo de cada site importat.

## Càrrega del logo — `src/space/site-logo.ts` (nou)

Utilitat pura/DOM sense React:

```ts
/** Llegeix un File d'imatge, el redimensiona a màx LOGO_MAX_PX de costat via
    <canvas> i el retorna com a data-URL (PNG, o l'original si és SVG). Rebutja
    (throw) si el resultat supera LOGO_MAX_CHARS o el fitxer no és imatge. */
export function fileToLogoDataUrl(file: File): Promise<string>
```

- `LOGO_MAX_PX` ~256. Redimensionar garanteix que el data-URL cap còmodament al
  límit de Salesforce Long Text (~131K chars).
- SVG es passa tal qual (text), validat per mida.
- Errors propaguen un missatge llegible perquè la UI el mostri.

## Hook — `src/space/useSpacePlan.ts`

Selectors derivats passen a navegar `site → place → space`:
- `activeSite`, `activePlace`, `activeSpace`.
- Tots els helpers que avui llegeixen/escriuen `d.places` passen a operar sobre
  `site.places` del site actiu (`activeSiteId`).

Noves accions (en paral·lel a les de Place):
- `addSite()` — crea un Site nou amb un Place+Space inicial; el fa actiu.
- `removeSite(siteId)` — mínim 1 site; reassigna `activeSiteId`.
- `renameSite(siteId, name)` — trim, max 40.
- `selectSite(siteId)`.
- `setSiteLogo(siteId, dataUrl | null)` — assigna o treu el logo (entra a l'historial
  undo/redo com qualsevol mutació).

Les accions de Place existents (`addPlace`, `removePlace`, …) passen a rebre el
context del site actiu (operen sobre `activeSite.places`).

## Tree view

### `src/components/space/SpacePlanTree.tsx` (vista 3D / read-only)

- Nou node de **nivell 1 = Site**. Mostra el **logo** (`<img>` petit) quan
  `site.image` no és null; si és null, fallback a la icona `address` actual.
- Places passen a nivell 2 (mantenen icona `address`), Spaces a nivell 3.
- Es recorre `sites → places → spaces`.

### `src/components/space/SpaceSidebar.tsx` (editor)

- Nou node Site (nivell 1) amb: mostrar logo o icona, editar nom (doble clic),
  botó **pujar/canviar logo**, botó **treure logo** (només si en té), `+ Lloc`,
  i eliminar Site (deshabilitat si només n'hi ha un).
- Places passen a nivell 2, Spaces a nivell 3 (la UI actual de places/spaces es
  conserva, només baixa un nivell).
- El botó de pujar logo dispara un `<input type="file" accept="image/*">` ocult →
  `fileToLogoDataUrl` → `setSiteLogo`. Errors es mostren inline (mateix patró que
  `importError`).

## Mock + persistència

- **`src/api/mock/mock-space-plan.ts`**: `createMockSpacePlan` retorna
  `{ v: 3, activeSiteId, activePlaceId, sites: [{ id, name, image: null, places: [...] }] }`.
  Es pot incloure un logo de demo opcional (data-URL petit) per il·lustrar la
  funció.
- **`src/space/space-plan-repository.ts`** i **`src/api/mirador-client.ts`**: la
  forma del payload `/space-plan` continua sent `SpacePlanData` serialitzat; no
  canvia cap signatura. Només canvia el contingut (ara amb `sites`).

## Consumidors a migrar (`data.places` → `data.sites[].places`)

- `src/panels/SpacePanel.tsx` (vista live de supervisió): avui fa
  `data.places.find(...)`. Passa a aplanar els places de tots els sites, o a
  operar dins el site actiu. **Decisió:** aplanar tots els places de tots els
  sites per al selector de plaça (la vista live no necessita conèixer el site;
  mostra plantes). _(Revisar en implementació si cal mostrar el site.)_
- `src/panels/SpaceEditorPanel.tsx`: passa `sites`/`activeSite` als components
  i connecta les noves accions de Site.
- `src/space/useSpacePlanData.ts`: només re-exporta `SpacePlanData`; cap canvi de
  lògica, però els consumidors d'aquest hook (SpacePanel) sí migren.

## Tests

- `src/space/space-plan-model.test.ts`: afegir casos per `sanitizeSpacePlan` amb
  sites (sites buits descartats, image invàlida → null, activeSiteId fallback),
  `defaultSpacePlan` retorna 1 site, `prepareImported` recrea sites amb ids nous i
  conserva logos.
- Test nou per `sanitizeImage` (prefixos vàlids/invàlids, límit de mida).
- `site-logo.ts`: test de validació de mida i rebuig de no-imatges (la part de
  `<canvas>` pot quedar coberta amb un test lleuger o mock segons l'entorn jsdom).
- Revisar `SpaceView.test.tsx` per adaptar fixtures a la nova forma.

## Fora d'abast

- Upload de fitxers real a Salesforce (ContentVersion/Files).
- Mapeig server-side a un objecte `Site__c` (es fa al backend, no a l'app).
- Reordenació de sites / drag&drop de places entre sites.
