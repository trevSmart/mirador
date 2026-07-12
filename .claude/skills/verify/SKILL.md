---
name: verify
description: Com arrencar i conduir Mirador per verificar canvis end-to-end al navegador
---

# Verificar Mirador end-to-end

## Arrencada

```bash
MIRADOR_DATA_SOURCE=mock npx vite --port 5199 --strictPort   # en background
```

`dev:mock` usa dades simulades — no cal cap org de Salesforce. El servidor és a punt quan `curl -sf http://localhost:5199` respon (~2 s).

## Conduir-la

Amb les tools MCP `chrome-devtools` (`new_page` → `http://localhost:5199`).

Fluxos útils: clicar una fila d'agent obre el drawer lateral de detalls; dins del drawer, les files de cues/feina fan drilldown. `#agents`, `#work`, `#skills` són pestanyes dockview.

## Gotchas

- **La simulació mock re-renderitza i reordena les files cada pocs segons**: els clics per coordenades (`click` amb uid d'un snapshot) sovint fallen en silenci perquè la fila s'ha mogut. Fes els clics via `evaluate_script` amb `element.click()` sobre el node trobat al moment.
- **Les files de les llistes principals són `div[role="button"]`, no `<button>`**: per buscar-les al DOM cal `querySelectorAll('[role="button"], button')`. Les files internes del drawer (`.dd-row`) sí que són botons natius.
- El drawer sempre està muntat: l'estat obert és la classe `is-open` a `.detail-drawer`; el contingut anterior es reté durant les animacions (durant una transició hi ha dues capes `.dd-head__name` al DOM).
- Per aturar el servidor: mata el procés de vite (o `npm run stop` si es va llançar amb el flux normal).
