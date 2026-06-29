# REST API — Third-Party Integration Guide

**Version:** `v1`  
**Entry point:** Apex REST at `/mirador/v1/*` (`@RestResource(urlMapping='/mirador/v1/*')`)  
**Status:** Production read surface + limited write (agent skills)

This API exposes a **domain-oriented** JSON API over Salesforce Apex REST. Responses use stable response shapes (agents, queues, skills, work items) — not raw Salesforce object layouts. Third-party clients should depend only on the contracts in this document.

---

## Base URL

All paths are relative to the org's Apex REST prefix:

```
https://{instance_url}/services/apexrest/mirador/v1
```

| Placeholder | Description |
|-------------|-------------|
| `{instance_url}` | Salesforce org URL returned by OAuth (e.g. `https://myorg.my.salesforce.com`) |

**Example:** `GET https://myorg.my.salesforce.com/services/apexrest/mirador/v1/agents`

Trailing slashes on resource paths are normalized away by the server.

---

## Authentication

### OAuth 2.0 Authorization Code + PKCE

Third-party clients authenticate with a Salesforce **External Client App (ECA)** using the public SPA flow (no client secret in the browser or mobile app).

| Item | Value |
|------|-------|
| Grant type | Authorization Code with **PKCE** (`S256`) |
| Recommended scopes | `api`, `refresh_token`, `offline_access` |
| Token endpoint | `POST {instance_url}/services/oauth2/token` |
| Authorize endpoint | `GET {instance_url}/services/oauth2/authorize` |

### Request headers

Every API call must include:

```http
Authorization: Bearer {access_token}
Accept: application/json
```

`PUT` requests must also send:

```http
Content-Type: application/json
```

### Session errors

Expired or invalid sessions return Salesforce's standard OAuth error payload (often HTTP 401 with `INVALID_SESSION_ID`). Clients should refresh the access token using the stored refresh token and retry once.

### Access control

- The ECA is **closed by default**; users need the appropriate Permission Set and ECA App Policies.
- API operations run **in the context of the authenticated user** (`with sharing` on all service classes except internal group-membership resolution).
- Object-level CRUD on underlying Salesforce records determines what write operations succeed. Use `GET /capabilities` to discover what the current user can do.

---

## Conventions

| Topic | Rule |
|-------|------|
| **Content type** | Request and response bodies are JSON (`application/json`). |
| **Identifiers** | Salesforce 15- or 18-character record IDs, serialized as strings. Agent IDs are **User** IDs (`005…`). Queue IDs are **Group** IDs (`00G…`). |
| **Timestamps** | ISO 8601 datetime strings in the org's timezone context (Apex `Datetime` JSON serialization). |
| **Nulls** | Absent optional fields may be omitted or `null`. |
| **Sorting** | Lists are ordered by the server (typically name or creation time) unless noted. |
| **Pagination** | Not implemented in v1. Result sets are bounded by internal SOQL `LIMIT` clauses (see [Limits](#limits)). |
| **Versioning** | Breaking changes require a new URL prefix (e.g. `/mirador/v2`). |

---

## Error responses

| HTTP status | When |
|-------------|------|
| `200` | Success |
| `400` | Malformed request (e.g. empty `PUT` body) |
| `403` | Permission denied (e.g. skill edit without CRUD on `ServiceResourceSkill`) |
| `404` | Unknown path |
| `500` | Unhandled server error |

Error body shape:

```json
{
  "error": "Human-readable message",
  "path": "/unknown"
}
```

`path` is included on `404` responses only.

---

## Snapshot

Full dashboard refresh in a single request. **Mirador's built-in polling uses this endpoint** to avoid four parallel calls to `/agents`, `/queues`, `/skills`, and `/work`. Third-party integrators may still call those individual resources for partial updates or lighter payloads.

### `GET /snapshot`

| Query param | Default | Description |
|-------------|---------|-------------|
| `scope` | `all` | Agent roster scope — same semantics as `GET /agents?scope=connected\|all` |

**Response `200`**

Top-level arrays (not nested under domain keys like the individual endpoints):

```json
{
  "agents": [ /* same shape as GET /agents → agents */ ],
  "queues": [ /* same shape as GET /queues → queues */ ],
  "skills": [ /* same shape as GET /skills → skills */ ],
  "work":   [ /* same shape as GET /work → work */ ]
}
```

**Example:** `GET /snapshot?scope=all`

---

## Capabilities

Discover which write features the authenticated user can use.

### `GET /capabilities`

**Response `200`**

```json
{
  "canChangePresence": false,
  "canReassignWork": false,
  "canChangeQueues": false,
  "canChangeSkills": true,
  "canFlagAgent": false,
  "liveUpdates": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `canChangePresence` | boolean | Always `false` in v1 (no backend endpoint). |
| `canReassignWork` | boolean | Always `false` in v1 (no backend endpoint). |
| `canChangeQueues` | boolean | `true` when the user has create **and** delete on `GroupMember`. No REST endpoint yet — flag only. |
| `canChangeSkills` | boolean | `true` when the user has create, update, **and** delete on `ServiceResourceSkill`. |
| `canFlagAgent` | boolean | Always `false` in v1. |
| `liveUpdates` | boolean | Always `false` in v1 (polling only). |

Clients should treat missing or non-boolean keys as `false`.

---

## Agents

### `GET /agents`

Returns Omni-Channel agents with presence, capacity, active work, queue membership, and embedded skills.

**Query parameters**

| Name | Default | Values | Description |
|------|---------|--------|-------------|
| `scope` | `connected` | `connected`, `all` | `connected` — users with a current `UserServicePresence`. `all` — every Omni-enabled user (via `PresenceUserConfigUser` / `PresenceUserConfigProfile`) **plus** every active `ServiceResource` of type Agent (`ResourceType='A'`, gated on read access to `ServiceResource`); users without presence are reported as `offline`. The Service-Resource branch mirrors Command Center for Service's offline service reps. |

**Response `200`**

```json
{
  "agents": [
    {
      "id": "005XXXXXXXXXXXXXXX",
      "name": "Alex Morgan",
      "role": "Senior Agent",
      "recordUrl": "https://myorg.my.salesforce.com/005XXXXXXXXXXXXXXX",
      "status": "online",
      "max": 5,
      "used": 2,
      "queueIds": ["00GXXXXXXXXXXXXXXX"],
      "loginMin": 47,
      "photo": "https://myorg.my.salesforce.com/profilephoto/005/T",
      "chans": { "veu": 1, "chat": 1, "email": 0, "wa": 0, "cas": 0 },
      "work": [
        {
          "id": "0BzXXXXXXXXXXXXXXX",
          "recordId": "500XXXXXXXXXXXXXXX",
          "label": "Case 00012345",
          "subject": "Billing inquiry",
          "channel": "Live Chat",
          "channelKey": "chat",
          "status": "Accepted",
          "queue": "Support Tier 1",
          "queueId": "00GXXXXXXXXXXXXXXX",
          "ageMin": 12
        }
      ],
      "skills": [
        {
          "id": "0HnXXXXXXXXXXXXXXX",
          "skillId": "0C5XXXXXXXXXXXXXXX",
          "name": "English",
          "type": "Language",
          "level": 5.0,
          "startDate": "2024-01-15T10:00:00.000Z",
          "lastModifiedDate": "2025-03-01T14:30:00.000Z",
          "lastModifiedBy": "Admin User"
        }
      ]
    }
  ]
}
```

#### Agent object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID (`005…`). |
| `name` | string | `User.Name`. |
| `role` | string | `User.Title`, or `"Agent"` when blank. |
| `recordUrl` | string \| null | Deep link to the User record in Lightning. |
| `status` | string | Normalized presence — see [Presence status](#presence-status). |
| `max` | integer | Configured Omni capacity (`UserServicePresence.ConfiguredCapacity`), default `5`. |
| `used` | integer | Count of active work items on the agent. |
| `queueIds` | string[] | Queue Group IDs from membership (including nested public groups) plus queues from active work. |
| `loginMin` | integer | Minutes in the current presence state. `0` when offline. |
| `photo` | string \| null | Absolute URL to the user's profile photo. |
| `chans` | object | Active work count per [channel key](#channel-keys). Keys: `veu`, `chat`, `email`, `wa`, `cas`. |
| `work` | array | Active `AgentWork` rows — see [Agent work item](#agent-work-item). |
| `skills` | array | Assigned skills — see [Agent skill](#agent-skill). Same shape as `GET /agents/{id}/skills`. |

#### Agent work item

Embedded on each agent. Represents an in-progress `AgentWork` record (`Status` in `Opened`, `Assigned`, `Accepted`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `AgentWork` ID. |
| `recordId` | string \| null | Underlying work record ID (e.g. Case `500…`). |
| `label` | string | Display label (e.g. `"Case 00012345"`). |
| `subject` | string \| null | Case subject when the work item is a Case. |
| `channel` | string \| null | `ServiceChannel.MasterLabel`. |
| `channelKey` | string | Normalized channel — see [Channel keys](#channel-keys). |
| `status` | string | Raw `AgentWork.Status` (e.g. `Accepted`). |
| `queue` | string \| null | Original queue name. |
| `queueId` | string \| null | Original queue Group ID. |
| `ageMin` | integer | Minutes since `AgentWork.RequestDateTime`. |

---

### `GET /agents/{userId}/skills`

Skills assigned to one agent via `ServiceResource` → `ServiceResourceSkill`.

**Path parameters**

| Name | Description |
|------|-------------|
| `userId` | Agent User ID (`005…`). |

**Response `200`**

```json
{
  "skills": [ /* Agent skill objects */ ]
}
```

Returns an empty `skills` array when the user has no `ServiceResource` or no assignments.

#### Agent skill

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `ServiceResourceSkill` ID. |
| `skillId` | string \| null | `Skill` ID. |
| `name` | string | Skill master label. |
| `type` | string \| null | `Skill.Type` master label (e.g. `Language`). |
| `level` | number \| null | `ServiceResourceSkill.SkillLevel`. |
| `startDate` | string \| null | `EffectiveStartDate`. |
| `lastModifiedDate` | string \| null | Last modification timestamp. |
| `lastModifiedBy` | string \| null | Name of last modifier. |

---

### `PUT /agents/{userId}/skills`

Add, update, or remove skill assignments for an agent.

**Requires:** `canChangeSkills: true` (CRUD on `ServiceResourceSkill`). The agent must have an active `ServiceResource` linked to the User.

**Path parameters**

| Name | Description |
|------|-------------|
| `userId` | Agent User ID (`005…`). |

**Request body**

```json
{
  "changes": [
    { "skillId": "0C5XXXXXXXXXXXXXXX", "level": 3 },
    { "skillId": "0C5YYYYYYYYYYYYYYY", "level": 5.0 },
    { "skillId": "0C5ZZZZZZZZZZZZZZZ", "remove": true }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `changes` | array | yes | List of skill mutations. May be empty (no-op). |
| `changes[].skillId` | string | yes* | Target `Skill` ID. |
| `changes[].level` | number | no | Skill level. On insert, sets `SkillLevel`. On update, changes level when different from current. |
| `changes[].remove` | boolean | no | When `true`, deletes the assignment. Default `false`. |

\*Entries with a null `skillId` are skipped.

**Semantics**

- **Insert** — `skillId` not currently assigned and `remove` is not `true`.
- **Update** — `skillId` already assigned and `level` is provided and differs.
- **Delete** — `remove: true` and assignment exists.

**Response `200`**

```json
{ "ok": true }
```

**Response `403`** — insufficient permissions or no `ServiceResource` for the user.

**Response `400`** — empty request body.

---

### `GET /skills/{skillId}/agents`

Agents qualified for a skill (via `ServiceResourceSkill`). Each agent uses the **same shape** as `GET /agents`, so clients can reuse agent-card UI components.

**Path parameters**

| Name | Description |
|------|-------------|
| `skillId` | `Skill` ID (`0C5…`). |

**Response `200`**

```json
{
  "agents": [ /* Agent objects */ ]
}
```

---

## Queues

### `GET /queues`

All Salesforce queues (`Group.Type = 'Queue'`) with backlog and staffing metrics.

**Response `200`**

```json
{
  "queues": [
    {
      "id": "00GXXXXXXXXXXXXXXX",
      "name": "Support Tier 1",
      "color": "#6A5BE8",
      "backlog": 14,
      "longest": 320,
      "avg": 95,
      "online": 6
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Queue Group ID. |
| `name` | string | Queue name. |
| `color` | string | Hex color assigned by the server (stable palette, not stored in Salesforce). |
| `backlog` | integer | Count of `PendingServiceRouting` rows with `IsReadyForRouting = true`. |
| `longest` | integer | Longest wait among backlog items, in **seconds**. |
| `avg` | integer | Average wait among backlog items, in **seconds**. |
| `online` | integer | Agents currently **online** (normalized presence) who are members of this queue (direct or via nested groups). |

---

## Skills

### `GET /skills`

Omni-Channel skill catalog with qualified-agent counts and routing backlog.

**Response `200`**

```json
{
  "skills": [
    {
      "id": "0C5XXXXXXXXXXXXXXX",
      "name": "English",
      "type": "Language",
      "typeId": "0C1XXXXXXXXXXXXXXX",
      "agents": 24,
      "backlog": 3
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `Skill` ID. |
| `name` | string | Master label. |
| `type` | string \| null | `Skill.Type` master label. |
| `typeId` | string \| null | `Skill.TypeId` — `SkillType` record ID. |
| `agents` | integer | Distinct active `ServiceResource` count with this skill. |
| `backlog` | integer | Pending work (`SkillRequirement` linked to ready `PendingServiceRouting`). |

Sorted by skill type, then name.

---

## Work

### `GET /work`

Unified view of work in flight: items **assigned** to agents and items **queued** for routing.

**Response `200`**

```json
{
  "work": [
    {
      "id": "0BzXXXXXXXXXXXXXXX",
      "subject": "Billing inquiry",
      "channelKey": "chat",
      "queueId": "00GXXXXXXXXXXXXXXX",
      "agentId": "005XXXXXXXXXXXXXXX",
      "status": "assigned",
      "ageSec": 720
    },
    {
      "id": "0JRXXXXXXXXXXXXXXX",
      "subject": "Password reset",
      "channelKey": "email",
      "queueId": "00GYYYYYYYYYYYYYYY",
      "agentId": null,
      "status": "queued",
      "ageSec": 145
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `AgentWork` ID when `status` is `assigned`; `PendingServiceRouting` ID when `queued`. |
| `subject` | string | Case subject, or fallback label. |
| `channelKey` | string | [Channel key](#channel-keys). |
| `queueId` | string \| null | Queue Group ID. |
| `agentId` | string \| null | Assigned agent User ID. `null` when queued. |
| `status` | string | `"assigned"` or `"queued"`. |
| `ageSec` | integer | Seconds since assignment request (`AgentWork`) or queue entry (`PendingServiceRouting.CreatedDate`). |

> **Note:** This shape differs from the work items embedded on `GET /agents` (which use `ageMin`, richer labels, and raw `AgentWork.Status`). Use `/work` for the operations work list; use agent-embedded `work` for the agent drawer.

---

## Reference values

### Presence status

Normalized from `ServicePresenceStatus.MasterLabel`:

| Value | Typical source labels |
|-------|----------------------|
| `online` | Available, Online, and other non-busy/away/offline labels |
| `busy` | Busy, Occupied, Ocupat |
| `away` | Away, Break, Absent |
| `offline` | Offline, Unavailable, or no current presence |

### Channel keys

Derived from `ServiceChannel.DeveloperName` and `MasterLabel`:

| Key | Matches (case-insensitive substring) | Typical UI label |
|-----|--------------------------------------|------------------|
| `veu` | phone, voice, call | Voice |
| `chat` | message, chat | Chat |
| `email` | email, mail | Email |
| `wa` | whatsapp | WhatsApp |
| `cas` | *(default)* | Case / generic |

---

## Limits

v1 does not expose cursor or offset pagination. Internal query limits (approximate upper bounds per response):

| Resource | Limit |
|----------|-------|
| Connected presences | 500 users |
| Agents (`scope=all`) | 5 000 Omni-enabled users + 5 000 active agent Service Resources |
| Active agent work | 2 000 `AgentWork` rows |
| Queued work | 2 000 `PendingServiceRouting` rows |
| Queues | 200 |
| Skills | 500 |
| Skill / queue backlog aggregation | 10 000 related rows |

Clients building dashboards should poll on an interval (integrator clients should use configurable polling intervals; `liveUpdates` is `false`).

---

## Permissions and setup

Third-party integrators need:

1. **External Client App** configured for Authorization Code + PKCE against the target org.
2. **CORS** — allow the client's origin on Salesforce Setup → CORS (and OAuth endpoints as required).
3. **Permission Set** — assign the external-user Permission Set (or equivalent) plus Omni Supervisor–aligned permissions for the data surfaced:
   - Read access to agents, queues, skills, and work implied by the user's Salesforce profile and sharing rules.
   - Write access to `ServiceResourceSkill` for `PUT /agents/{id}/skills`.
4. **ECA App Policies** — authorize the Permission Set / profiles that may obtain tokens.

The API does not implement a separate API key layer; the OAuth access token is the sole credential.

---

## Example: fetch connected agents

```bash
curl -sS \
  -H "Authorization: Bearer 00D..." \
  -H "Accept: application/json" \
  "https://myorg.my.salesforce.com/services/apexrest/mirador/v1/agents"
```

## Example: update agent skills

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer 00D..." \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"skillId":"0C5XXXXXXXXXXXXXXX","level":4}]}' \
  "https://myorg.my.salesforce.com/services/apexrest/mirador/v1/agents/005XXXXXXXXXXXXXXX/skills"
```

---

## Endpoint summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/capabilities` | Write-feature flags for the current user |
| `GET` | `/snapshot` | Full dashboard refresh (`?scope=connected\|all`, default `all`) — **use for polling** |
| `GET` | `/agents` | Agent roster (`?scope=connected\|all`) |
| `GET` | `/agents/{userId}/skills` | Skills for one agent |
| `PUT` | `/agents/{userId}/skills` | Add/update/remove agent skills |
| `GET` | `/skills/{skillId}/agents` | Agents qualified for a skill |
| `GET` | `/queues` | Queue metrics |
| `GET` | `/skills` | Skill catalog |
| `GET` | `/work` | Assigned + queued work items |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Added `GET /snapshot` for single-call dashboard refresh; individual read endpoints unchanged. |
| 2026-06-20 | Initial third-party specification for v1 (read endpoints + `PUT` skills + `/capabilities`). |
