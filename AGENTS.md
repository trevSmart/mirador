# AGENTS.md

Guidance for AI coding agents working in this repository. Keep it accurate: when
you change architecture, commands, or conventions, update this file in the same
change.

## What this project is

**Mirador** is a contact-center observability dashboard. It is a React 19 + Vite
single-page app (`src/`) backed by a Salesforce org. The frontend reads a
domain-oriented JSON API (agents, queues, skills, work items) served by Apex REST
in the org; it never talks to raw Salesforce objects.

**Functional baseline:** Mirador must do everything Salesforce's standard
supervisor experience does — the product formerly known as **Omni Supervisor**,
renamed **Command Center for Service** in recent releases. Treat feature parity
with Command Center for Service as the floor, not the ceiling: any capability the
standard supervisor offers (real-time agent/queue monitoring, work assignment
oversight, skills, etc.) should have an equivalent here.

The repository is a **dual project**:

- **`src/`** — the SPA (TypeScript, React 19, Vite 8). This is where most work happens.
- **`force-app/`** — the Salesforce DX metadata: Apex classes that implement the
  REST API, External Client App (ECA) OAuth definitions, skill types, custom
  objects for the space plan.

> `README.md` is an **end-user / product-facing** pitch for supervisors — it
> deliberately carries no architecture, stack, or dev detail. This file (and the
> code) is the authoritative map for agents; don't look to `README.md` for
> technical facts, and don't add internal detail to it.

## Tech stack

- React 19 with the **React Compiler** enabled (`babel-plugin-react-compiler` via
  `@vitejs/plugin-react` + `@rolldown/plugin-babel`). Do not hand-write `useMemo`/
  `useCallback` purely for referential stability the compiler already provides;
  but the existing code does use them deliberately in hot paths — match local style.
- Vite 8 dev server on **port 3000**, with a custom middleware (`src/server/`)
  serving `/api/*` endpoints.
- `dockview-react` for the draggable/dockable multi-panel workspace.
- **TanStack Query v5** as the data/cache layer (caching, request dedup, and
  polling for all server state) — see "Data Service layer" below.
- TypeScript ~6.0, ESLint 10 (flat config), Prettier, Knip for dead-code checks,
  Vitest for unit tests.
- Salesforce Apex (`sourceApiVersion` 66.0) for the backend.

## Commands

```bash
npm run dev          # Vite dev server on :3000 (real Salesforce data by default)
npm run dev:mock     # Dev server forced to mock data (MIRADOR_DATA_SOURCE=mock)
npm run build        # tsc -b && vite build
npm run preview      # serve the production build on :3000
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run knip         # report unused files/exports/deps
npm run stop         # kill the dev server (scripts/stop-server.js)
npm run icons:app    # regenerate AppIconName after adding/removing SVG glyphs
npm run slds:build   # regenerate public/slds/* sprites + icons.css from SLDS package
```

Frontend unit tests run on **Vitest** (`npm run test`); test files sit next to the
code as `*.test.ts(x)` (jsdom env; config in the `test` block of `vite.config.ts`
plus `vitest.setup.ts`). Apex has its own tests (`*Test.cls`) — prefer the IBM
Salesforce Context MCP when available; otherwise `sf apex run test`. Husky
`pre-commit` runs `npm run precommit`, which currently just runs `npm run lint`.

Verify changes with `npm run lint`, `npm run test`, and `npm run build` (the
type-check happens in `tsc -b`). Note: `tsc -b` excludes `*.test.ts(x)`, so test
files are type-checked only by the editor / Vitest, not the build. After icon
SVG or SLDS package changes, also run `npm run icons:app` / `npm run slds:build`
and commit the generated outputs.

## Data sources: mock vs. Salesforce

The app runs against either **mock** data or a **real Salesforce** org. Resolution
order:

1. Server env `MIRADOR_DATA_SOURCE` (`mock` | `salesforce`, default `salesforce`)
   is exposed via `GET /api/config` (see `src/server/load-env.ts`).
2. `getDataSource` / `isMockMode` in `src/config/data-source.ts` read that config.
3. A user preference `mockOverride` (Settings modal) can force mock at runtime.

In mock mode, `MiradorApiProvider` builds a `createMockMiradorClient()`
(`src/api/mock/`) instead of a network client — no auth required. Use
`npm run dev:mock` to develop UI without an org.

**Mock record Ids:** every Salesforce-shaped entity in mock data (agents, queues,
skills, work items, presence statuses, etc.) must use **18-character Ids** with
the correct object key prefix (`005` User, `00G` Group/queue, `0C5` Skill, …).
Never use short placeholder strings like `'ac'` or `'a0'` as record Ids — they
do not match production and skew behaviour that depends on Id shape (e.g.
`colorFromRecordId`). Centralize Ids in `src/api/mock/mock-ids.ts` via
`mockSfId()` and keyed maps (`MOCK_QUEUE`, `MOCK_AGENT`, …); seed specs may
keep short internal keys but must resolve to real Ids at build time.

## Architecture

### Provider tree (`src/App.tsx`)

The app is composed of nested context providers, outermost first:

```
PreferencesProvider            # user settings, persisted to localStorage
  AuthProvider                 # OAuth session + isMockMode
    MiradorApiProvider         # builds the API client (real or mock)
      DataServiceProvider      # TanStack Query client: cache, dedup, polling
        DockviewHostProvider   # the panel workspace host
          ModalRegistryProvider  # tracks open modals (blocks global shortcuts)
            DetailDrawerProvider
              SettingsModalProvider
                DevConsoleProvider
                  GlobalShortcutsProvider  # keyboard shortcuts table
                    ToastProvider
                      ErrorBoundary -> AppGate -> AppContent
                        (AppHeader + DockviewShell + DetailDrawer +
                         SettingsModal + DevConsole)
```

Bootstrap happens in `src/main.tsx`: `installBfcacheReload()`, then
`bootstrapAuth()` + `preloadPublicConfig()` before React mounts; a splash screen
is dismissed afterward (`src/bootstrap/dismiss-splash.ts`).

### API layer (`src/api/`)

- `mirador-client.ts` — `createMiradorClient(getSession)` builds the typed REST
  client against `{instanceUrl}/services/apexrest/mirador/v1`. Handles bearer
  auth, JSON parsing, and **one** automatic session-recovery retry on 401 /
  expired-session.
- `types.ts` — the canonical domain contracts (`Agent`, `Queue`, `Skill`,
  `WorkItem`, `Capabilities`, request/response shapes). These mirror the Apex REST
  responses; keep them in sync with `force-app` and `docs/mirador-REST-API.md`.
- `mock/` — a self-contained fake backend (`mock-client.ts`, `mock-seed.ts`,
  `mock-state.ts`, avatars) implementing the same `MiradorClient` interface.
- `skill-mutations.ts` — `useUpdateAgentSkills()` (TanStack Mutation); invalidates
  the snapshot cache on success.

#### Data Service layer (`src/api/data-service/`, `src/api/data-hooks.ts`)

The **single seam** between the integration layer (the client) and the UI, built
on **TanStack Query** — it provides caching and request deduplication so the same
data is never fetched twice unnecessarily. There is no bespoke data provider or
compatibility shim; the UI reads server state exclusively through these hooks.

Organized along three axes — **source** (external app) → **entity** (type) →
**params** (id/filter) — so it scales to new screens, entity types and even new
external apps:

- `query-client.ts` / `DataServiceProvider.tsx` — the global `QueryClient`.
- `sources.ts` — source registry (`SourceClientMap` + `useSourceClient`). A new
  external app = extend the map and add a `case` here.
- `resource.ts` + `resources/` — per-entity descriptors via `defineResource`:
  `recordDetailResource` (the work-item backing record), `agentTimelineResource`,
  and the snapshot-backed `agent/queue/skill/workItem` resources.
  `batch-loader.ts` coalesces concurrent id loads into a single request (e.g. one
  `POST /records/details` for N ids).
- `use-entity.ts` — `useEntity` / `useEntities` for per-id reads.
- `data-hooks.ts` — the UI's data entry point: `useAgents` / `useQueues` /
  `useSkills` / `useWork` (typed selectors over **one shared snapshot query**,
  polling via TanStack `refetchInterval` from `prefs.autoRefresh` /
  `prefs.refreshInterval`; scope `all` | `connected` follows
  `prefs.showOfflineAgents`) and `useDataStatus` (`{ isLoading, isRefreshing,
  error, refresh }`). `fetchSnapshot` fetches the snapshot **and** primes the
  per-entity cache, so per-id `useEntity` reads resolve from cache.

Mutations should invalidate the snapshot (`invalidateQueries` on `snapshotKey` /
  `snapshotPrefix()`) on success — see `useUpdateAgentSkills` as the pattern.

### Auth (`src/auth/`)

OAuth 2.0 **Authorization Code + PKCE** against a Salesforce External Client App
(public SPA flow, no client secret in the browser).

- `salesforce-oauth.ts` — login redirect, PKCE, token exchange, refresh, session
  validity, callback handling, logout, photo-proxy URL builders.
- The token exchange goes through the dev server proxy at `/api/oauth/token`
  (`src/server/oauth-token-proxy.ts`) rather than calling Salesforce directly.
- Sessions are persisted via `oauth-session-storage.ts`; `getValidAccessSession()`
  transparently refreshes expired tokens.
- `scope`: `api refresh_token offline_access`.

### Dev server middleware (`src/server/`)

Registered as a Vite plugin in `vite.config.ts`. Routes:

- `GET /api/config` — public OAuth config + `dataSource` for the SPA.
- `POST /api/oauth/token` — server-side OAuth token proxy.
- `/api/oauth/userinfo` — proxies Salesforce userinfo (avoids CORS).
- `/api/salesforce/photo*` — proxies Salesforce user photos (avoids CORS / leaking
  the access token to image tags).

Env (`.env`, see `.env.example`): `SF_CLIENT_ID`, `SF_LOGIN_URL`,
`SF_REDIRECT_URI`, and optionally `MIRADOR_DATA_SOURCE`.

### Panels & workspace (`src/panels/`, `src/dockview/`)

- `registry.ts` is the single source of truth for menu panels. Each
  `PanelDefinition` has a `type`, `title`, `icon`, and a **lazy-loaded**
  component wrapped in a per-panel `Suspense` + `ErrorBoundary`. Add a new panel
  by adding one entry here (and, if it should appear in the "+" menu, a group in
  `PANEL_MENU_GROUPS`).
- Panel types: `home`, `wallboard`, `agents`, `queues`, `skills`, `work`, `space`,
  `spaceEditor`, plus Customize/dev panels `devLab`, `devLab2`, and
  `colorPlayground` (experimental — safe to remove as a unit with their panel
  files under `src/panels/` and related `src/components/dev/`).
- Entity detail can open as a **dockable tab** (`DetailPanel`, component id
  `detail`) as well as the slide-over drawer — see `src/detail/` and
  `src/panels/detail-tab-actions.ts`.
- `src/dockview/` handles layout persistence, tab groups, context menus, theming.
- `src/navigation/` — `createAppNavigator` is the **only** entry point for opening
  panels/detail from the app (header, Home grid, shortcuts, drawer). Keeps
  `location.hash` / Navigation API history in sync (`#agents`,
  `#detail/agent/<id>`, …).

### Space view (`src/space/`, `src/components/space/`)

2D/3D isometric "space plan" of the contact center (seats, agents, towers).
Geometry/projection helpers in `src/space/`; UI in `src/components/space/`.
Persisted via Apex `MiradorSpacePlanService` (`GET`/`PUT /space-plan`) against
custom objects `Space__c` / `Folder__c`.

### Icons

**Read [`docs/icons.md`](docs/icons.md) before adding or changing any icon.** Two
worlds, no exceptions:

- **Chrome glyphs** (`AppIcon`): one SVG per icon in `src/assets/icons/` — never
  inline `<svg>` in a component. After add/remove: `npm run icons:app`.
- **Salesforce object tiles** (`SfIcon`): full sprites in `public/slds/` (generated
  by `npm run slds:build`, never edit by hand).

Color: object **type** → official SLDS color (no `bg`); concrete **record** →
`recordId={id}` on `SfIcon` (respects `tintRecordIcons`). No hardcoded icon colors
elsewhere.

### Other notable areas

- `src/components/ds/` — design-system primitives (Button, Badge, Ring, Toast,
  `AppIcon`, `SfIcon`, …). Prefer these over ad-hoc markup.
- `src/components/error/` — error boundaries, the Mirador-styled dev error
  overlay (replaces Vite's default HMR overlay, which is disabled in
  `vite.config.ts`), and Vite error formatting.
- `src/settings/` — `Preferences` model (flat object in localStorage, sanitized on
  load), providers, and the settings modal.
- `src/shortcuts/` — declarative global keyboard shortcuts (`shortcuts.ts`);
  listener in `GlobalShortcutsProvider`.
- `src/modals/` — modal open-state registry so shortcuts don't fire while a modal
  is open.
- `src/detail/` — detail drawer context, dockable detail-tab helpers, entity
  resolution.
- `src/dev/` — developer console (`devLog`, `DevConsole`). Experimental panel
  UIs live under `src/panels/DevLab*` and `src/components/dev/`, not here.
- `src/utils/` — pure helpers (formatting, metrics, color, search, health
  insights). Keep these side-effect-free.

## Salesforce backend (`force-app/main/default/`)

- `classes/MiradorRestHandler.cls` / `MiradorApi.cls` — the `@RestResource`
  entry point at `/mirador/v1/*`.
- `classes/Mirador*Service.cls` — domain services (agent, queue, skill, work,
  snapshot, capability, record details, timeline, space plan, …) producing the
  response shapes in `src/api/types.ts`.
- `externalClientApps/` + `extlClntApp*OauthSets/` — ECA OAuth config for the SPA
  login flow.
- `skilltypes/` — `MiradorLanguage`, `MiradorExpertise` skill types.
- `objects/` — `Space__c`, `Folder__c` (space plan), plus Case field customizations.
- `lwc/ownerReassignAction` — Lightning action used from the org UI.
- `permissionsets/` — Mirador external / agent permission sets.
- `*Test.cls` — Apex unit tests.

The HTTP contract is documented in [`docs/mirador-REST-API.md`](docs/mirador-REST-API.md);
auth setup in [`docs/salesforce-authentication.md`](docs/salesforce-authentication.md).
When you change the API on either side, update both ends **and** that doc.

For Salesforce org operations in Cursor, prefer the **IBM Salesforce Context** MCP
tools over the Salesforce CLI. Common CLI fallbacks when MCP is unavailable:
`sf project deploy start`, `sf project retrieve start`, `sf apex run test`,
`sf org open`.

## Conventions

- **Language:** UI strings, `devLog` messages, and some comments are in **Catalan**
  (`ca` is the default `lang`). Match the surrounding language of the file you edit.
- **Imports:** ESM only (`"type": "module"`). Use the existing relative-import
  style; there are no path aliases.
- **Styling:** plain CSS (`src/index.css`) + SLDS. No CSS-in-JS framework.
- **Icons:** see [`docs/icons.md`](docs/icons.md) and the Icons section above.
- **State:** server/remote data lives in TanStack Query (the Data Service layer);
  read it through `data-hooks.ts` (`useAgents`, `useDataStatus`, …) or `useEntity`,
  never via a bespoke provider. UI/app state uses React context per concern. No
  Redux/Zustand.
- **Navigation:** open panels/detail only via `createAppNavigator` (or hooks that
  wrap it) — do not call Dockview APIs ad hoc from random UI.
- **Lazy loading:** panels are code-split; keep heavy panels lazy.
- **Errors:** wrap risky UI in the shared `ErrorBoundary`; surface API failures
  through `useDataStatus().error`.
- **Lint/format:** run `npm run lint` and respect Prettier (`.prettierrc`).
  `dist/`, `tmp/`, `public/`, `.sfdx/` are lint-ignored.
- **Never bypass an ESLint or Knip rule** (no `eslint-disable` comments, no `knip`
  ignores) to make an issue go away — fix the underlying problem instead. If a
  bypass genuinely is the right call in a specific case, ask the user for
  confirmation first.

## Gotchas

- The dev server **must** be running for `/api/config`, `/api/oauth/token`,
  `/api/oauth/userinfo`, and the photo proxy to exist — the SPA can't authenticate
  from a bare static build.
- Real-data mode needs a configured `.env` and an org with the Apex REST deployed;
  use `npm run dev:mock` when you don't have that.
- `port 3000` is hard-coded for dev, preview, and the OAuth redirect URI — keep
  them aligned.
- `devLab` / `devLab2` / `colorPlayground` and `src/components/dev/` are
  experimental and removable; don't build production features on them.
- **The document root must stay `overflow: hidden`** (`html, body, #root` in
  `index.css`). Mirador is a fixed-viewport dashboard — every panel scrolls
  internally and the window must never scroll. If the root is allowed to scroll, at
  fractional device-pixel ratios (browser zoom ≠ 100% → e.g. dpr 1.8) sub-pixel
  rounding can leave total content ~1px taller than the viewport, flickering the
  window scrollbar on and off. Each toggle changes the layout width by the
  scrollbar's ~16px, which cascades through Dockview; **Dockview's own
  `ResizeObserver` reacts to the size change and recomputes every frame**, turning
  it into a self-sustaining infinite reflow loop that repaints the scrollbars
  forever and pegs the CPU at 100%. It only reproduces at non-100% zoom, which
  makes it easy to misattribute — note that Lenis's always-rescheduling `raf` is a
  red herring here (a paused debugger lands on it because it runs every frame, but
  disabling Lenis entirely does not stop the loop; removing/re-adding a Dockview
  container in devtools does, because it forces a clean relayout). Don't reintroduce
  root scrolling.

## Cursor Cloud specific instructions

The startup update script runs `npm install` after pulling the latest code, so
dependencies are already present when a session begins. Standard commands live in
the **Commands** section above; the notes below are the non-obvious cloud caveats.

- **No Salesforce org / secrets are available in the cloud VM.** Run and test the
  SPA in **mock mode** with `npm run dev:mock` (dev server on port `3000`, no
  `.env` or OAuth needed). `npm run dev` (real-data mode) will only render the
  login flow and cannot fetch data here. Confirm the server is up and in mock mode
  with `curl -s http://localhost:3000/api/config` → `"dataSource":"mock"`.
- **Manual UI testing works headless** against the mock dev server: the whole
  dashboard (agents, queues, skills, work, space view, agent detail drawer) is
  populated from `src/api/mock/`, so no backend is required to exercise core flows.
- `npm install` prints Babel 8 `EBADENGINE` warnings on the VM's Node (the Babel
  toolchain wants Node ≥ 22.18); these are harmless — install, `npm run build`,
  `npm run test`, and the dev server all work regardless.
- Apex/Salesforce work (`force-app/`, `sf` CLI, `npm run` has no Apex hook) cannot
  be deployed or tested from the cloud VM without an org; treat the backend as
  read-only reference unless an org is provided.

### Real (Salesforce) mode

The VM has outbound access to `login.salesforce.com` / `test.salesforce.com`, so
real mode works here when configured. To run it:

- Provide `SF_CLIENT_ID`, `SF_LOGIN_URL`, `SF_REDIRECT_URI` either as **env-var
  secrets** (preferred — `vite.config.ts` `loadEnv(mode, cwd, '')` merges
  `process.env`, so no file is needed and they survive to fresh VMs) or as a local
  `.env` (git-ignored, so a `.env` does NOT persist across sessions). Then run
  `npm run dev` (default `MIRADOR_DATA_SOURCE=salesforce`). Confirm with
  `curl -s localhost:3000/api/config` → non-empty `sfClientId` + `"dataSource":"salesforce"`.
- Dev-org credentials are available as secrets `SF_TEST_USERNAME` /
  `SF_TEST_PASSWORD`; enter them into the Salesforce login form. `SF_TEST_OTP_SEED`
  is a placeholder ("ask user"), **not** a real TOTP seed — the verification code
  changes each login and must be requested from the user interactively.
- Complete the OAuth Authorization-Code+PKCE login in the VM's Chrome. **Login
  cannot be made fully headless/automatic** for two reasons: (1) Salesforce fires
  an email/OTP "Verify Your Identity" challenge on each fresh VM (unknown IP) whose
  code must be obtained from the user each time; (2) the OAuth session is encrypted
  in `localStorage` but its AES key is in `sessionStorage`
  (`src/auth/oauth-session-storage.ts`), so the saved session is undecryptable after
  a browser/tab restart or on a new VM → expect to re-auth every session. For
  zero-touch automation you'd need a headless auth path (e.g. OAuth JWT-bearer),
  which is a code change, not env setup.
- The ECA's callback URL must exactly match `SF_REDIRECT_URI`
  (`http://localhost:3000/oauth/callback`), and the org must have the Mirador Apex
  REST deployed for data to load.
