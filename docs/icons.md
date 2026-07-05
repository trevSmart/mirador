# Sistema d'icones de Mirador

Hi ha **exactament dos mons d'icones**. Abans d'afegir-ne cap, decideix a quin
pertany:

| | Icones de la app (`AppIcon`) | Icones d'objecte Salesforce (`SfIcon`) |
|---|---|---|
| Què són | Glyphs monocroms de chrome: tancar, chevron, lupa, refresh, settings… | Tiles de color que identifiquen un SObject (case, account, custom47…) |
| On viuen | `src/assets/icons/*.svg` (un fitxer = una icona) | Sprites **complets** `public/slds/standard.svg` i `custom.svg` |
| Component | `<AppIcon name="close" size={16} />` | `<SfIcon sprite="standard" symbol="case" />` (o `name`/`channel`) |
| Color | Hereta `color` del context (`currentColor`) | Oficial SLDS per defecte; `bg` per tintar |

**Prohibicions** (això és el que va degenerar el sistema anterior):

- ❌ Cap `<svg><path d="…">` inline a components. Si necessites un glyph nou,
  crea un fitxer a `src/assets/icons/`.
- ❌ Cap color d'icona hardcodejat en mapes TS o vars CSS. El color d'objecte és
  la classe SLDS generada; el de registre és `colorFromRecordId`.
- ❌ No editar mai els fitxers generats (`public/slds/*`,
  `app-icon-names.generated.ts`): els escriuen els scripts.
- ❌ No empaquetar res més de `docs/salesforce-lightning-design-system-icons/`:
  aquesta carpeta és NOMÉS un magatzem de consulta per a humans durant el
  desenvolupament.

## Regla de color

- **Icona que identifica un TIPUS d'objecte** (pestanya de panell, capçalera,
  categoria): color oficial SLDS. No passis `bg` — la classe
  `slds-icon-{sprite}-{símbol}` del `icons.css` generat ja el posa.
- **Icona que representa un REGISTRE** (una cua, un skill, un work item
  concret): tinta-la amb `bg={colorFromRecordId(record.id)}` perquè cada
  registre es distingeixi visualment. El mateix id dona sempre el mateix color.

## Afegir una icona de la app

1. Copia l'SVG de `docs/salesforce-lightning-design-system-icons/utility/`
   (o crea'l tu si és un glyph propi) a `src/assets/icons/`.
   - Copiada d'SLDS → conserva el nom del símbol (`refresh.svg`).
   - Pròpia → nom semàntic kebab-case (`rotate-y.svg`).
2. Normalitza'l: treu `width`/`height` de l'`<svg>` arrel (deixa el `viewBox`)
   i canvia `fill="#fff"` per `fill="currentColor"` (o
   `fill="none" stroke="currentColor"` si és de traç).
3. `npm run icons:app` — regenera la union `AppIconName` i valida la
   normalització.
4. Committeja l'SVG + `app-icon-names.generated.ts`.

El test `src/components/ds/app-icon.test.ts` falla si el registre i els tipus
es desincronitzen.

## Icones d'objecte Salesforce

No cal afegir-hi res mai: els sprites `standard` i `custom` s'empaqueten
**sencers** precisament perquè els usuaris poden configurar qualsevol SObject
(estàndard o custom) com a work item del seu routing, i el detall n'ha de poder
resoldre la icona en temps d'execució (`resolveWorkItemIcon` a
`src/utils/salesforce-object-icon.ts`).

## Bump de versió SLDS

1. Actualitza la versió exacta de `@salesforce-ux/design-system` a
   `package.json` + `npm install`.
2. `npm run slds:build` — regenera `public/slds/standard.svg`, `custom.svg` i
   `icons.css` (colors oficials complets) des del paquet.
3. Committeja els outputs. El test `src/components/ds/slds-assets.test.ts`
   valida que tot el que el codi referencia hi és.
4. Si vols refrescar el magatzem de consulta, actualitza també
   `docs/salesforce-lightning-design-system-icons/` (còpia de
   `node_modules/@salesforce-ux/design-system/assets/icons/`).
