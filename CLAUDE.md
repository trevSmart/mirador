# Mirador

## Icones — llegeix docs/icons.md abans de tocar-ne cap

Dos mons, sense excepcions:

- **Glyphs de chrome** (tancar, chevron, refresh…): un fitxer SVG a
  `src/assets/icons/` + `<AppIcon name="…">`. Mai `<svg>` inline a un
  component. Després d'afegir/esborrar un SVG: `npm run icons:app`.
- **Icones d'objecte Salesforce** (tiles de color): `<SfIcon>` sobre els sprites
  complets de `public/slds/` (generats amb `npm run slds:build`, no editar a mà).

Color: tipus d'objecte → color oficial SLDS (cap `bg`); registre concret
(cua, skill, work item…) → `bg={colorFromRecordId(id)}`. Cap color d'icona
hardcodejat enlloc més.

## Verificació

- Typecheck: `npx tsc -b` (`tsc --noEmit` no comprova res en aquest repo).
- Tests: `npm run test` (vitest).
