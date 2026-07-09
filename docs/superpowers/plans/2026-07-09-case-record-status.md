# Estat real del cas al drawer de detall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al drawer de detall d'un work-item l'estat REAL del registre de Salesforce (per a `Case`: obert/tancat) al costat de l'estat del work-item d'Omni-Channel (Assignat/En cua), en comptes de només aquest últim.

**Architecture:** L'estat "Assignat" que es veu avui ve de `WorkStatus` (`assigned`|`queued`), que descriu la posició del work-item dins Omni-Channel — mai l'estat del cas. L'estat real del cas viu a Salesforce (`Case.Status` / `Case.IsClosed`) i s'ha de propagar per tota la cadena: Apex (`MiradorRecordDetailsService`) → JSON REST → tipus TS `RecordDetail` → mock client → drawer (`WorkItemDetail`). Seguim el patró `containsKey` ja existent al servei Apex, que afegeix camps només quan el tipus els declara.

**Tech Stack:** Apex (backend REST), TypeScript + React (frontend), Vitest (tests TS), Apex tests (`@IsTest`).

## Global Constraints

- Typecheck: `npx tsc -b` (mai `tsc --noEmit` — no comprova res en aquest repo).
- Tests TS: `npm run test` (vitest).
- Abast d'aquesta feina: el drawer mostra l'estat del registre quan el backend retorna `recordStatus`/`recordClosed` (p.ex. `Case.Status`/`Case.IsClosed`). Si un tipus no exposa aquests camps, el drawer no mostra el badge d'estat del registre.
- Icones i colors: no s'afegeix cap color hardcodejat; el badge fa servir els tons existents de `Badge` (`neutral`|`accent`|`ok`|`watch`|`alert`).
- Català amb ortografia correcta a tot el text d'UI.

---

### Task 1: Afegir `Status`/`IsClosed` al DTO Apex (només Case)

**Files:**
- Modify: `force-app/main/default/classes/MiradorRecordDetailsService.cls`
- Test: `force-app/main/default/classes/MiradorRecordDetailsServiceTest.cls`

**Interfaces:**
- Produces: `RecordDetailDto` guanya dos camps nous — `String recordStatus` (valor de `Case.Status`, p.ex. `"Closed"`) i `Boolean recordClosed` (valor de `Case.IsClosed`). Tots dos `null` per a tipus que no els declaren. El JSON REST els inclou automàticament (serialització genèrica via `JSON.serialize`).

- [ ] **Step 1: Escriure el test que falla**

Afegir aquest mètode a `MiradorRecordDetailsServiceTest.cls` (dins la classe, després de `getRecordDetailsForCase`):

```apex
    @IsTest
    static void getRecordDetailsCaseStatus() {
        Case open = new Case(Subject = 'Obert', Status = 'New');
        insert open;
        Case closed = new Case(Subject = 'Tancat', Status = 'Closed');
        insert closed;

        Test.startTest();
        MiradorRecordDetailsService.RecordDetailsResponse response =
            MiradorRecordDetailsService.getRecordDetails(new List<Id>{ open.Id, closed.Id });
        Test.stopTest();

        Map<Id, MiradorRecordDetailsService.RecordDetailDto> byId =
            new Map<Id, MiradorRecordDetailsService.RecordDetailDto>();
        for (MiradorRecordDetailsService.RecordDetailDto dto : response.records) {
            byId.put((Id) dto.id, dto);
        }

        System.assertEquals('New', byId.get(open.Id).recordStatus, 'open status');
        System.assertEquals(false, byId.get(open.Id).recordClosed, 'open not closed');
        System.assertEquals('Closed', byId.get(closed.Id).recordStatus, 'closed status');
        System.assertEquals(true, byId.get(closed.Id).recordClosed, 'closed is closed');
    }
```

I al test genèric `getRecordDetailsGenericType` afegir, després de l'assert de `caseNumber`:

```apex
        System.assertEquals(null, dto.recordStatus, 'no recordStatus for Account');
        System.assertEquals(null, dto.recordClosed, 'no recordClosed for Account');
```

- [ ] **Step 2: Executar el test i verificar que falla**

Run: usar l'eina MCP `run_apex_test` amb la classe `MiradorRecordDetailsServiceTest`.
Expected: FAIL — `Variable does not exist: recordStatus` (el DTO encara no té els camps).

- [ ] **Step 3: Implementar el canvi mínim al servei**

A `MiradorRecordDetailsService.cls`, dins `RecordDetailDto` (després de `subject`):

```apex
        public String recordStatus; // Case.Status (i altres tipus amb Status, futur)
        public Boolean recordClosed; // Case.IsClosed
```

Actualitzar el capçalera-comentari del bloc `Case →` (línia ~6) perquè digui:
`*   - Case            → CaseNumber, Subject, Status, IsClosed`

Dins `queryType`, després de `Boolean hasSubject = ...` (línia ~82):

```apex
        Boolean hasStatus = fields.containsKey('status');
        Boolean hasIsClosed = fields.containsKey('isclosed');
```

Després dels blocs `if (hasSubject) { selectFields.add('Subject'); }` (línia ~90):

```apex
        if (hasStatus) {
            selectFields.add('Status');
        }
        if (hasIsClosed) {
            selectFields.add('IsClosed');
        }
```

Dins el bucle `for (SObject record : Database.query(soql))`, després del bloc `if (hasSubject) { ... }` (línia ~110):

```apex
            if (hasStatus) {
                dto.recordStatus = (String) record.get('Status');
            }
            if (hasIsClosed) {
                dto.recordClosed = (Boolean) record.get('IsClosed');
            }
```

- [ ] **Step 4: Executar el test i verificar que passa**

Run: `run_apex_test` amb `MiradorRecordDetailsServiceTest`.
Expected: PASS — tots els mètodes verds, inclòs `getRecordDetailsCaseStatus`.

- [ ] **Step 5: Desplegar el metadata**

Desplegar `MiradorRecordDetailsService.cls` i `MiradorRecordDetailsServiceTest.cls` amb l'eina MCP `deploy_metadata`.
Expected: desplegament correcte.

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/classes/MiradorRecordDetailsService.cls force-app/main/default/classes/MiradorRecordDetailsServiceTest.cls
git commit -m "feat(records): expose Case Status/IsClosed in record details service"
```

---

### Task 2: Afegir els camps d'estat al tipus TS i al mock

**Files:**
- Modify: `src/api/types.ts:163-170`
- Modify: `src/api/mock/mock-client.ts:42-55`
- Test: `src/api/mock/mock-client.test.ts` (si no existeix, crear-lo)

**Interfaces:**
- Consumes: JSON REST de la Task 1 (`recordStatus`, `recordClosed`).
- Produces: `RecordDetail` guanya `recordStatus?: string | null` i `recordClosed?: boolean | null`. El mock retorna aquests camps per a ids de `Case` (prefix `500`).

- [ ] **Step 1: Escriure el test que falla**

Crear/afegir a `src/api/mock/mock-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createMockClient } from './mock-client'

describe('mock record details', () => {
  it('marks a closed case id as closed', async () => {
    const client = createMockClient()
    const res = await client.getRecordDetails({ ids: ['500000000000CLOSE'] })
    const rec = res.records[0]
    expect(rec.objectApiName).toBe('Case')
    expect(rec.recordStatus).toBe('Closed')
    expect(rec.recordClosed).toBe(true)
  })
})
```

Nota: verificar el nom exacte de la factory exportada a `mock-client.ts` (`createMockClient` o similar) i ajustar l'import si cal.

- [ ] **Step 2: Executar el test i verificar que falla**

Run: `npm run test -- mock-client`
Expected: FAIL — `recordStatus` és `undefined` (el mock encara no el retorna).

- [ ] **Step 3: Implementar**

A `src/api/types.ts`, dins `interface RecordDetail` (després de `subject?`):

```ts
  recordStatus?: string | null
  recordClosed?: boolean | null
```

A `src/api/mock/mock-client.ts`, dins `mockRecordDetail`, al `return` (després de `subject:`):

```ts
    recordStatus: isCase ? (id.includes('CLOSE') ? 'Closed' : 'New') : null,
    recordClosed: isCase ? id.includes('CLOSE') : null,
```

- [ ] **Step 4: Executar el test i verificar que passa**

Run: `npm run test -- mock-client`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: sense errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/api/mock/mock-client.ts src/api/mock/mock-client.test.ts
git commit -m "feat(types): add recordStatus/recordClosed to RecordDetail"
```

---

### Task 3: Helper d'etiqueta i ton per a l'estat del cas

**Files:**
- Modify: `src/utils/format.ts`
- Test: `src/utils/format.test.ts` (si no existeix, crear-lo)

**Interfaces:**
- Consumes: `RecordDetail.recordStatus` / `recordClosed` (Task 2).
- Produces: `recordStatusLabel(detail: Pick<RecordDetail, 'recordStatus' | 'recordClosed'>): string | null` — retorna `null` quan no hi ha estat; si no, l'etiqueta en català (`'Tancat'` quan `recordClosed`, si no el valor cru de `recordStatus`). I `recordStatusTone(detail): 'neutral' | 'ok'` — `'neutral'` si tancat, `'ok'` si obert.

- [ ] **Step 1: Escriure el test que falla**

Afegir a `src/utils/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { recordStatusLabel, recordStatusTone } from './format'

describe('recordStatusLabel', () => {
  it('returns null when no status', () => {
    expect(recordStatusLabel({ recordStatus: null, recordClosed: null })).toBeNull()
  })
  it('labels a closed case', () => {
    expect(recordStatusLabel({ recordStatus: 'Closed', recordClosed: true })).toBe('Tancat')
  })
  it('falls back to raw status when open', () => {
    expect(recordStatusLabel({ recordStatus: 'New', recordClosed: false })).toBe('New')
  })
  it('tone is neutral when closed, ok when open', () => {
    expect(recordStatusTone({ recordStatus: 'Closed', recordClosed: true })).toBe('neutral')
    expect(recordStatusTone({ recordStatus: 'New', recordClosed: false })).toBe('ok')
  })
})
```

- [ ] **Step 2: Executar el test i verificar que falla**

Run: `npm run test -- format`
Expected: FAIL — `recordStatusLabel is not a function`.

- [ ] **Step 3: Implementar**

A `src/utils/format.ts`, afegir l'import de tipus a dalt si cal (`import type { ..., RecordDetail } from '../api/types'`) i les funcions:

```ts
export function recordStatusLabel(
  detail: Pick<RecordDetail, 'recordStatus' | 'recordClosed'>,
): string | null {
  if (detail.recordClosed) return 'Tancat'
  return detail.recordStatus ?? null
}

export function recordStatusTone(
  detail: Pick<RecordDetail, 'recordStatus' | 'recordClosed'>,
): 'neutral' | 'ok' {
  return detail.recordClosed ? 'neutral' : 'ok'
}
```

- [ ] **Step 4: Executar el test i verificar que passa**

Run: `npm run test -- format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/format.ts src/utils/format.test.ts
git commit -m "feat(format): add recordStatusLabel/recordStatusTone helpers"
```

---

### Task 4: Mostrar els dos badges al drawer

**Files:**
- Modify: `src/components/detail/WorkItemDetail.tsx`

**Interfaces:**
- Consumes: `recordStatusLabel` / `recordStatusTone` (Task 3), `recordQuery.data` (`RecordDetail | null`, ja existent al component).
- Produces: cap (component d'UL final).

- [ ] **Step 1: Actualitzar l'import de format**

A `src/components/detail/WorkItemDetail.tsx:8`, afegir els dos helpers:

```ts
import {
  channelLabel,
  formatDateTime,
  formatSeconds,
  recordStatusLabel,
  recordStatusTone,
  workStatusLabel,
} from '../../utils/format'
```

- [ ] **Step 2: Derivar l'estat del registre**

Després de `const detail = recordQuery.data ?? null` (línia ~38), afegir:

```ts
  const recordStatus = detail ? recordStatusLabel(detail) : null
```

- [ ] **Step 3: Afegir el segon badge a la capçalera**

A la capçalera (`<div className="dd-head__id">`, línia ~51-57), després del `<Badge tone="neutral">{workStatusLabel(item.status)}</Badge>`:

```tsx
          {recordStatus ? (
            <Badge tone={recordStatusTone(detail!)}>{recordStatus}</Badge>
          ) : null}
```

- [ ] **Step 4: Afegir la Stat "Estat del cas" al Resum**

Dins el `<StatGrid>` del `DrawerSection title="Resum"` (línia ~77-82), després de la Stat "Estat" del work-item, afegir:

```tsx
          {recordStatus ? <Stat label="Estat del registre" value={recordStatus} /> : null}
```

Nota: la Stat existent `label="Estat"` mostra el work-status (Assignat/En cua); aquesta nova és l'estat real del registre. Deixar les dues.

- [ ] **Step 5: Typecheck i tests**

Run: `npx tsc -b && npm run test`
Expected: sense errors TS; tots els tests verds.

- [ ] **Step 6: Verificació manual amb el skill `run`**

Obrir l'app en mode real, navegar al cas 00001036 (que és `Closed` a Salesforce) i confirmar que el drawer mostra ara un badge "Tancat" al costat de "Assignat", i la Stat "Estat del registre" = "Tancat".

- [ ] **Step 7: Commit**

```bash
git add src/components/detail/WorkItemDetail.tsx
git commit -m "feat(detail): show real record status badge alongside work-item status"
```

---

## Self-Review

**Spec coverage:**
- "Mostrar estat del cas i estat del work-item" → Task 4 (dos badges + Stat). ✓
- "Ha de ser així per tots els objectes" → l'arquitectura és genèrica (patró `containsKey` Apex + helper TS que retorna `null` quan no hi ha estat). Per ara només `Case` popula els camps (decisió "Només Case ara"); altres objectes no mostren el badge però la canonada els suporta sense canvis d'estructura. ✓
- Backend només Case (`Status`+`IsClosed`) → Task 1. ✓

**Placeholder scan:** cap TODO/TBD; tot el codi és literal.

**Type consistency:** `recordStatus`/`recordClosed` consistents a Apex DTO (camel via serialització), `RecordDetail` TS, mock, helpers i component. `recordStatusLabel`/`recordStatusTone` amb la mateixa signatura a Task 3 i Task 4.

**Nota de risc a verificar durant execució:** confirmar el nom exacte de la factory del mock client (`createMockClient`) i que el JSON REST d'Apex serialitza `recordStatus`/`recordClosed` en camelCase igual que `caseNumber` (ja és el cas per als camps existents, mateix mecanisme).
