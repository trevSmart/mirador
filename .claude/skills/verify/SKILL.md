---
name: verify
description: Com arrencar i conduir Mirador per verificar canvis end-to-end al navegador
---

# Verificar Mirador end-to-end

## Arrencada

```bash
npm run dev:mock     # llança-ho en background; port 3000
```

Usa dades simulades — no cal cap org de Salesforce. El port 3000 està hardcodejat (dev, preview i redirect URI d'OAuth): no el canviïs. El servidor és a punt quan `curl -sf http://localhost:3000` respon (~2 s). Per aturar-lo: `npm run stop`.

## Conduir-la

Amb les tools MCP `chrome-devtools` (`new_page` → `http://localhost:3000`).

Fluxos útils: clicar una fila d'agent obre el drawer lateral de detalls; dins del drawer, les files de cues/feina fan drilldown. `#agents`, `#work`, `#skills` són pestanyes dockview.

## Gotchas

- **Si l'usuari ja té un dev server a :3000** (amb dades reals), Vite salta a :3001 i t'ho diu al log — llegeix-lo per saber a quin port connectar-te, i no matis el servidor de l'usuari.
- **La simulació mock re-renderitza i reordena les files cada pocs segons**: els clics per coordenades (`click` amb uid d'un snapshot) sovint fallen en silenci perquè la fila s'ha mogut. Fes els clics via `evaluate_script` amb `element.click()` sobre el node trobat al moment.
- **Les files de les llistes principals són `div[role="button"]`, no `<button>`**: per buscar-les al DOM cal `querySelectorAll('[role="button"], button')`. Les files internes del drawer (`.dd-row`) sí que són botons natius.
- El drawer sempre està muntat: l'estat obert és la classe `is-open` a `.detail-drawer`; el contingut anterior es reté durant les animacions (durant una transició hi ha dues capes `.dd-head__name` al DOM).
