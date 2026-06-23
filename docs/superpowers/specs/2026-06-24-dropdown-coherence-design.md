# Coherència de dropdowns — Disseny

**Data:** 2026-06-24
**Branca:** settings2

## Objectiu

Tots els menús desplegables / popovers de l'aplicació han de compartir el mateix
comportament visual: **mateixa transició d'apertura i tancament, mateix
border-radius, mateixa opacitat de fons i mateix backdrop-filter (glass)**.

Abast: combo boxes (selects), menú d'usuari, menú d'afegir panell, dropdown de
resultats de cerca, i qualsevol futur dropdown.

A més, deixar preparat un sistema d'**scrim reutilitzable** (capa de fons
difuminada) que es pugui afegir de forma trivial a dropdowns, modals, toasts,
etc., sense estar acoblat a cap d'ells.

## Estat actual (resum)

| Component | Fitxer | Transició | Radius | Glass | Animació |
|---|---|---|---|---|---|
| UserMenu | `src/components/UserMenu.tsx` | 0.18s | 11px | no | `.dropdown-panel` + `syncDropdownPanel` |
| GlobalSearch | `src/components/GlobalSearch.tsx` | 0.18s | 12px | no | `.dropdown-panel` + `syncDropdownPanel` |
| AddPanel | `src/components/AddPanelHeaderActions.tsx` | **cap** | 8px | no | `{isOpen ? …}` sec |
| Select Floor | `src/panels/FloorPanel.tsx` | natiu | 10px | no | `<select>` natiu |
| Select Settings | `src/components/settings/parts.tsx` | natiu | 10px | no | `<select>` natiu |

Ja existeix una base parcial: la classe compartida `.dropdown-panel`
(`src/index.css` ~388-402) i la utilitat `syncDropdownPanel`
(`src/utils/sync-dropdown-panel.ts`). El `--blur-glass` (blur(10px)) està
definit però **sense ús** → es reaprofitarà.

## Decisions preses

1. **Selects natius → custom.** Es converteixen a un combo box custom perquè els
   `<select>` natius no permeten controlar transició/radius/blur del panell.
2. **Tokenitzar.** Es creen variables dedicades; els dropdowns hi apunten. Es
   netegen tokens que quedin orfes (esborrar o reusar).
3. **Glass al panell ara, scrim com a sistema independent** per després. Sense
   scrim per defecte als dropdowns.
4. **Un sol component `Select` compartit** per a Floor i Settings.

## Arquitectura

### 1. Tokens (`src/index.css`, a `:root`)

```css
--dropdown-radius: 11px;             /* canònic (= antic --r-md de UserMenu) */
--dropdown-dur: .18s;
--dropdown-ease: var(--ease);
--dropdown-blur: var(--blur-glass);  /* blur(10px), abans sense ús */
--dropdown-bg: <surface-card amb alpha>;  /* semitransparent perquè es vegi el blur */
--dropdown-shadow: var(--shadow-lift);
--dropdown-offset: .5rem;            /* translateY inicial */

/* Scrim (sistema independent i reutilitzable) */
--scrim-bg: rgba(27, 25, 36, .28);   /* alinear amb el del DetailDrawer */
--scrim-blur: var(--blur-scrim);     /* blur(2px) */
--z-scrim: <valor coherent amb la pila de z-index>;
```

El valor exacte de `--dropdown-bg` es derivarà de `--surface-card` amb
transparència (p.ex. via color-mix o un rgba equivalent) de manera que el glass
sigui perceptible però el contingut llegible.

### 2. `.dropdown-panel` — única font de veritat

`.dropdown-panel` passa a definir radius, fons, blur, ombra i transició via
tokens. Les classes específiques (`.user-menu__dropdown`, `.qsearch-drop`,
`.add-panel-control__dropdown`, i les del nou `Select`) **deixen de redefinir**
aquestes propietats; només conserven el que és propi: mida, posició, padding
intern i layout.

```css
.dropdown-panel {
  opacity: 0;
  visibility: hidden;
  transform: translateY(calc(var(--dropdown-offset) * -1));
  transition: opacity var(--dropdown-dur) var(--dropdown-ease),
              transform var(--dropdown-dur) var(--dropdown-ease),
              visibility 0s linear var(--dropdown-dur);
  pointer-events: none;
  border-radius: var(--dropdown-radius);
  background: var(--dropdown-bg);
  backdrop-filter: var(--dropdown-blur);
  -webkit-backdrop-filter: var(--dropdown-blur);
  box-shadow: var(--dropdown-shadow);
}
.dropdown-panel.is-open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition: opacity var(--dropdown-dur) var(--dropdown-ease),
              transform var(--dropdown-dur) var(--dropdown-ease),
              visibility 0s linear 0s;
  pointer-events: auto;
}
```

La durada de `syncDropdownPanel` (`DROPDOWN_TRANSITION_MS = 180`) ja coincideix
amb `--dropdown-dur` (.18s). Es manté.

### 3. Scrim reutilitzable (`.ui-scrim`)

Classe genèrica, independent de dropdowns:

```css
.ui-scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim-bg);
  backdrop-filter: var(--scrim-blur);
  -webkit-backdrop-filter: var(--scrim-blur);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--dur-base) var(--ease), visibility 0s linear var(--dur-base);
  z-index: var(--z-scrim);
}
.ui-scrim.is-open {
  opacity: 1;
  visibility: visible;
  transition: opacity var(--dur-base) var(--ease), visibility 0s linear 0s;
}
```

Afegir scrim a qualsevol overlay futur = renderitzar `<div class="ui-scrim is-open">`
darrere. El `DetailDrawer` actual manté el seu backdrop propi (fora d'abast ara;
candidat a migrar després).

### 4. Component `Select` compartit (`src/components/ds/Select.tsx`)

Combo box custom reutilitzable al design system. Substitueix `.fv-select`
(FloorPanel) i `.settings-select` (SettingsModal).

**Interfície (proposta):**
```ts
type SelectOption = { value: string; label: string }
type SelectProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  id?: string
  ariaLabel?: string
  // mida/variant si cal alinear amb fv vs settings
}
```

**Responsabilitats:**
- Renderitza un trigger (botó) + panell `.dropdown-panel`.
- Animació via `syncDropdownPanel`.
- Accessibilitat: `role="listbox"`/`option`, navegació amb fletxes, Enter per
  seleccionar, Escape per tancar, focus management, tancament en click-fora.

**Dependències:** `syncDropdownPanel`, tokens CSS.

## Components afectats

- `src/components/UserMenu.tsx` — sense canvis JS; neteja CSS redundant de
  `.user-menu__dropdown`.
- `src/components/GlobalSearch.tsx` — sense canvis JS; neteja CSS redundant de
  `.qsearch-drop` (es manté l'animació pròpia de `height` del contingut).
- `src/components/AddPanelHeaderActions.tsx` — migrar a `syncDropdownPanel` +
  `.dropdown-panel` (avui no té animació).
- `src/panels/FloorPanel.tsx` — substituir 3 `<select>` per `Select`.
- `src/components/settings/parts.tsx` — `SelectField` passa a usar `Select`.
- `src/index.css` — nous tokens, `.dropdown-panel` unificada, `.ui-scrim`,
  neteja de classes redundants i tokens orfes.

## Neteja de tokens

Després de migrar, repassar tokens que quedin sense ús (p.ex. radius o blurs que
ja no es referenciïn) i esborrar-los o reusar-los. `--blur-glass` deixa d'estar
orfe en passar a `--dropdown-blur`.

## Testing / verificació

- Verificació visual al navegador: obrir cada dropdown (UserMenu, GlobalSearch,
  AddPanel, els selects de Floor i Settings) i comprovar que l'animació, el
  radius i el glass són idèntics.
- Selects custom: provar navegació amb teclat (fletxes/Enter/Escape), click-fora
  i selecció amb ratolí.
- Comprovar que no hi ha regressions de layout/posició en cap dropdown.

## Fora d'abast

- Migrar el backdrop del `DetailDrawer` a `.ui-scrim` (candidat futur).
- Aplicar scrim a dropdowns concrets (es farà després, però el sistema queda
  llest).
