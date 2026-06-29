# TODO

Registre de tasques pendents d'implementar que anem detectant.

- [ ] Backlog de cues: revisar com es comporta el **supervisor estàndard d'Omni-Channel** (Omni Supervisor) i fer-ho igual. Actualment `MiradorQueueService.cls` calcula el backlog des de `PendingServiceRouting` (treball pendent d'encaminar per Omni-Channel), no des de Cases assignats a la cua (`Case.OwnerId` = cua). En orgs sense routing d'Omni-Channel actiu (com mirador-dev2-dev-ed, on `COUNT(PendingServiceRouting) = 0`) totes les cues mostren backlog 0 encara que tinguin cases assignats (p. ex. case 00001038 a `International - Silver/Bronze`). Cal mirar quina mètrica/objecte fa servir l'Omni Supervisor per a "En cua / En espera" i alinear-hi el càlcul abans de decidir el model definitiu (només Cases / Omni / híbrid).
- [ ] Revisar secció Connexió del modal de settings
- [ ] Migrar tots els estats de UI restants al sistema unificat (vegeu `StatusScreen`, spec `docs/superpowers/specs/2026-06-28-status-screen-design.md`). Pendents de convergir: `PanelState` (6 panells) i `PanelErrorFallback`; drawers (`dd-empty`); inline (`panel-section__empty`, `color-playground__empty`, espais); header chips (`app-header__status`, `app-header__warning`); `qsearch-empty` (GlobalSearch); settings (`settings-error-text`, estats de connexió); dev console (`dev-console__empty`).
- [ ] afegeix possibilitat dexportar i importar la configurció de sites/placzes/llocs a JSON
- [ ] veure si l'estandard mostra o no agents sense service resource vinculats.