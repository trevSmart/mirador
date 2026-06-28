# Inventari de local storage i candidats per persistir a l'org

> Estat de l'app a data 2026-06-28. Inventari de tot el que es guarda al navegador
> (localStorage / sessionStorage) i anàlisi de què tindria sentit moure a Salesforce.

## Resum

L'app fa servir **localStorage** i **sessionStorage** amb implementacions pròpies
(cap llibreria tipus redux-persist / zustand persist / TanStack Query persister).
Totes les claus tenen prefix `mirador`.

`clearLocalData()` ([src/utils/clear-local-data.ts](../src/utils/clear-local-data.ts))
esborra totes les claus amb prefix `mirador` de localStorage i sessionStorage,
**excepte** el plànol (`mirador.floorPlan.v1`), que es preserva explícitament.

## Inventari complet

> Llegenda: 🔴 sempre local · 🟢 candidat per l'org (preferència) · 🟠 dades de negoci (objecte custom)

| # | Clau | Magatzem | Contingut | TTL | A l'org? | Fitxer |
|---|------|----------|-----------|-----|:--------:|--------|
| 1 | `mirador_oauth_session` | localStorage | Tokens OAuth (access/refresh, instance URL, expiry) **xifrats AES-GCM** | `expiresAt` (def. 7200s) | 🔴 | [src/auth/oauth-session-storage.ts](../src/auth/oauth-session-storage.ts) |
| 2 | `mirador_oauth_aes_key` | sessionStorage | Clau AES-GCM 256-bit de sessió per desxifrar el punt 1 | fins a logout | 🔴 | [src/auth/oauth-session-storage.ts](../src/auth/oauth-session-storage.ts) |
| 3 | `mirador_oauth_pkce_verifier` | localStorage | Verifier PKCE (transitori durant login) | consumit al callback | 🔴 | [src/auth/salesforce-oauth.ts](../src/auth/salesforce-oauth.ts) |
| 4 | `mirador_oauth_state` | localStorage | State CSRF OAuth (transitori) | consumit al callback | 🔴 | [src/auth/salesforce-oauth.ts](../src/auth/salesforce-oauth.ts) |
| 5 | `mirador.preferences.v1` | localStorage | Preferències d'usuari (refresh, autoRefresh, SLA, alertes, idioma, formats, notificacions, animacions, avatars, tint…) | — | 🟢 | [src/settings/preferences.ts](../src/settings/preferences.ts) |
| 6 | `mirador.developerMode` | localStorage | Flag dev mode (sync cross-tab) | — | 🔴 | [src/hooks/useDeveloperMode.ts](../src/hooks/useDeveloperMode.ts) |
| 7 | `mirador.devConsole.visible` / `.minimized` / `.height` / `.filters` | localStorage | Estat de la consola de debug | — | 🔴 | [src/dev/DevConsoleContext.tsx](../src/dev/DevConsoleContext.tsx) |
| 8 | `mirador-dockview-layout-v1` | localStorage | Layout de panells dockview (`DockviewApi.toJSON()`) | — | 🟢 | [src/dockview/layout-storage.ts](../src/dockview/layout-storage.ts) |
| 9 | `mirador.home.split` / `mirador.floor-editor.split` | localStorage | Posició dels splitters (fracció 0.25–0.75) | — | 🟢 | [src/panels/HomePanel.tsx](../src/panels/HomePanel.tsx), [src/panels/FloorEditorPanel.tsx](../src/panels/FloorEditorPanel.tsx) |
| 10 | `mirador.home.queueSort` / `mirador.home.agentSort` | localStorage | Ordenació de llistes | — | 🟢 | [src/panels/HomePanel.tsx](../src/panels/HomePanel.tsx) |
| 11 | `mirador.floor.zoom` | localStorage | Zoom de la vista de planta (0.5–3.0, debounce 250ms) | — | 🟢 | [src/components/floor/floor-zoom.ts](../src/components/floor/floor-zoom.ts) |
| 12 | `mirador.floor-rotation.v1` | localStorage | Rotació càmera 3D per sala `{ [floorId]: { az, tilt } }` | — | 🟢 | [src/floor/floor-rotation-store.ts](../src/floor/floor-rotation-store.ts) |
| 13 | `mirador.floorPlan.v1` | localStorage | **Dades del plànol** (seients, assignacions, plantes) | — (preservat al clear) | 🟠 | [src/floor/floor-plan-repository.ts](../src/floor/floor-plan-repository.ts) |
| 14 | `mirador.detailRecents.v1` | localStorage | Últims ítems vistos (agents/cues/skills, màx 10) | — | 🟢 | [src/utils/detail-recent-store.ts](../src/utils/detail-recent-store.ts) |

## Classificació segons on hauria de viure

### 🔴 S'ha de quedar SEMPRE a local (mai a l'org)

- **1–4 OAuth / PKCE / AES** — secrets de sessió i tokens. Per disseny van xifrats i
  lligats al dispositiu. Pujar-ho a l'org seria un problema greu de seguretat.
- **6–7 dev mode / dev console** — estat de depuració per màquina; no té sentit centralitzar-ho.

### 🟢 Té molt sentit moure a l'org (preferències d'usuari → segueixen l'usuari)

Avui es perden en canviar de navegador, de dispositiu o en netejar dades.

- **5 `mirador.preferences.v1`** — el candidat número u. Preferències explícites de l'usuari.
- **8 layout dockview**, **9 splitters**, **10 ordenacions**, **11 zoom**, **12 rotació 3D**,
  **14 recents** — la "memòria d'espai de treball".

### 🟠 Cas especial — dades de negoci, no preferència

- **13 `mirador.floorPlan.v1`** — **no és una preferència, són dades compartides**
  (el plànol amb seients i assignacions). Avui viu només al navegador de qui edita:
  cada usuari veu un plànol diferent i es perd amb un `clear`. **Hauria de viure a l'org**,
  però com a **objecte de dades compartit** (p. ex. `FloorPlan__c` / `Seat__c`),
  no com a blob de preferència personal.

## Recomanació

Avui hi ha **dos models de persistència** barrejats que convindria separar:

1. **Preferències personals per usuari** (5, 8–12, 14): un registre per usuari.
   Via neta a Salesforce → **Custom Setting de tipus Hierarchy** o objecte
   `UserPreference__c` amb camp `Prefs__c` (Long Text / JSON) lligat a `OwnerId`.
   Permet patró **local-first amb sync**: llegir local per velocitat, escriure a l'org en background.

2. **Dades del plànol** (13): model de dades real i compartit (objectes custom),
   no un JSON blob. És el canvi de més impacte: avui és dada de negoci atrapada en un navegador.

> ⚠️ L'org local **encara no té cap objecte custom** ([force-app/main/default/](../force-app/main/default/)
> només conté l'External Client App OAuth, classes Apex i skills/skilltypes). Qualsevol
> d'aquests moviments implica crear metadata nova d'objectes.
