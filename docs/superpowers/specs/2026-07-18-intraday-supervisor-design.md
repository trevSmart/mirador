# Mirador com a sala de control intraday

**Estat:** proposta d’iniciativa (pendent d’aprovació d’equip)  
**Data:** 2026-07-18  
**Presentació:** canvas `intraday-supervisor` (obrir al costat del xat a Cursor)

## Problema

Els supervisors de contact centers grans fan **intraday management**: quan el dia es desvia del pla de WFM, han de reequilibrar capacitat en 15–30 minuts. Un cas típic: una cua sobrecarregada → moure agents crosstrainats d’una cua amb holgura.

Mirador avui és fort en **visibilitat** (snapshot, wallboard, agents/cues/skills/work) i gairebé nul en **acció** (només edició de skills + space plan). El risk és quedar-nos en «wallboard millor» en lloc de ser l’eina que s’obre quan hi ha foc.

## Tesi

Mirador **no** ha de ser un WFM (forecast/schedule). Ha de ser la **sala de control del dia**: Detectar → Diagnosticar → Actuar → Verificar.

## Estat actual (audit juliol 2026)

| Necessitat | Veure | Canviar |
|------------|-------|---------|
| Cua sobrecarregada (wait/backlog) | Sí (caveat PSR) | No |
| Membres de cua | Sí | No |
| Skills d’agent | Sí | Sí |
| Membership de cua | Visible | **No API/UI** (`canChangeQueues` = flag only) |
| Presence / reassign work | Sí / llista | No (capabilities false; UI placeholder) |
| Alerta → acció | Banner Home | Navega a panells, no proposa |

Caveat: backlog = `PendingServiceRouting`; sense Omni routing, el senyal pot fallar (`docs/TODO.md`).

## Cas estrella (H1)

1. Senyal: cua en alerta  
2. Diagnòstic: poc Available / cobertura  
3. Candidats elegibles: online + capacitat + skills + no a la cua + origen amb holgura  
4. Acció: afegir/treure `GroupMember`  
5. Verificar: snapshot refrescat, wait/backlog baixen  

Skills edit és útil per SBR, **no** substitueix membership en routing per cua.

## Horitzons

- **H1 — Tancar el loop:** backlog fiable · API/UI membership · picker d’elegibles · wire «Reassigna agents»
- **H2 — Guiar:** recomanacions «mou N» · playbooks · umbrals · SLA al banner  
- **H3 — Control room:** presence · reassign work · alertes · log d’accions · overflow  

**Recomanació:** H1 abans que H2. El picker sense membership no tanca el job; membership sense picker ja ajuda.

## Principis

1. Acció prop del senyal (des de la cua en risc)  
2. Elegibilitat explícita (per què aquest agent)  
3. Respectar contacte en curs (canvis quan Idle)  
4. Capacitats honestes (no botons fantasma)  
5. Intraday ≠ planificació  
6. Recurrència diària → escalat a WFM, no normalitzar-ho a Mirador  

## Roadmap proposat

0. Model de backlog (PSR / Cases / híbrid)  
1. API + UI membership de cua  
2. Picker d’agents elegibles ranquejat  
3. Insights → CTA  
4. Presence / reassign (si l’org ho permet)  
5. Log d’accions intraday  

## Decisions pendents d’equip

1. Compromís H1 com a prioritat de producte?  
2. Model de backlog alineat amb el supervisor estàndard?  
3. Qui valida el flux amb supervisors reals (shadowing)?  

## Fonts

- Gans, Koole & Mandelbaum (2003) — OR de call centers  
- Genesys / Aspect — RTA + intraday  
- HiveDesk — playbook triggers/respostes  
- Webex / Dynamics — assignació d’agents a cues en temps real  
- Paritat producte: Omni Supervisor → Command Center for Service (`AGENTS.md`)
