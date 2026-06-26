# AGENTS.md

Guidance for AI coding agents working in this repository. Keep it accurate: when
you change architecture, commands, or conventions, update this file in the same
change.

## What this project is

**Mirador** is a contact-center observability dashboard. It is a React 19 + Vite
single-page app (`src/`) backed by a Salesforce org. The frontend reads a
domain-oriented JSON API (agents, queues, skills, work items) served by Apex REST
in the org; it never talks to raw Salesforce objects.

The repository is a **dual project**:

- **`src/`** — the SPA (TypeScript, React 19, Vite 8). This is where most work happens.
- **`force-app/`** — the Salesforce DX metadata: Apex classes that implement the
  REST API, External Client App (ECA) OAuth definitions, skill types.

> Note: `README.md` is still the stock Salesforce DX template and does **not**
> describe the SPA. Trust this file and the code, not `README.md`, for the app.

## Tech stack

- React 19 with the **React Compiler** enabled (`babel-plugin-react-compiler` via
  `@vitejs/plugin-react` + `@rolldown/plugin-babel`). Do not hand-write `useMemo`/
  `useCallback` purely for referential stability the compiler already provides;
  but the existing code does use them deliberately in hot paths — match local style.
- Vite 8 dev server on **port 3000**, with a custom middleware (`src/server/`)
  serving `/api/*` endpoints.
- `dockview-react` for the draggable/dockable multi-panel workspace.
- TypeScript ~6.0, ESLint 10 (flat config), Prettier, Knip for dead-code checks.
- Salesforce Apex (`sourceApiVersion` 66.0) for the backend.

## Commands

```bash
npm run dev          # Vite dev server on :3000 (real Salesforce data by default)
npm run dev:mock     # Dev server forced to mock data (MIRADOR_DATA_SOURCE=mock)
npm run build        # tsc -b && vite build
npm run preview      # serve the production build on :3000
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run knip         # report unused files/exports/deps
npm run stop         # kill the dev server (scripts/stop-server.js)
```

There is currently **no frontend test runner script**. `jest.config.js` is the
Salesforce LWC Jest config and is not wired to the SPA. Apex has its own tests
(`*Test.cls`) run via `sf apex run test`. Husky `pre-commit` runs
`npm run precommit`, which currently just runs `npm run lint`.

Verify changes with `npm run lint` and `npm run build` (the type-check happens in
`tsc -b`).

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

## Architecture

### Provider tree (`src/App.tsx`)

The app is composed of nested context providers, outermost first:

```
PreferencesProvider          # user settings, persisted to localStorage
  AuthProvider               # OAuth session + isMockMode
    MiradorApiProvider       # builds the API client (real or mock)
      MiradorDataProvider    # fetches snapshot, polling, refresh coalescing
        DockviewHostProvider # the panel workspace host
          DetailDrawerProvider
            SettingsModalProvider
              DevConsoleProvider
                ErrorBoundary -> AppContent (AppHeader + DockviewShell)
```

Bootstrap happens in `src/main.tsx`: `bootstrapAuth()` + `preloadPublicConfig()`
run before React mounts; a splash screen is dismissed afterward
(`src/bootstrap/dismiss-splash.ts`).

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
- `MiradorDataProvider.tsx` — owns app data state (agents/queues/skills/work),
  loads via `getSnapshot('all')`, supports silent background polling
  (`prefs.autoRefresh` / `prefs.refreshInterval`), and **coalesces + rate-limits**
  refreshes (`MIN_REFRESH_GAP_MS = 1500`). Data and status are split into two
  contexts so data updates don't re-render status-only consumers.

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
- `/api/salesforce/photo*` — proxies Salesforce user photos (avoids CORS / leaking
  the access token to image tags).

Env (`.env`, see `.env.example`): `SF_CLIENT_ID`, `SF_LOGIN_URL`,
`SF_REDIRECT_URI`, and optionally `MIRADOR_DATA_SOURCE`.

### Panels & workspace (`src/panels/`, `src/dockview/`)

- `registry.ts` is the single source of truth for panels. Each `PanelDefinition`
  has a `type`, `title`, `icon`, and a **lazy-loaded** component wrapped in a
  per-panel `Suspense` + `ErrorBoundary`. Add a new panel by adding one entry here.
- Panel types: `home`, `wallboard`, `agents`, `queues`, `skills`, `work`, `floor`,
  `floorEditor`, and `dev` (**EXPERIMENTAL** — vectorial floor projection; the
  whole feature lives in `src/dev/` and is meant to be deletable as a unit).
- `src/dockview/` handles layout persistence, tab groups, context menus, theming.

### Floor view (`src/floor/`, `src/components/floor/`)

2D/3D isometric "floor plan" of the contact center (seats, agents, towers).
Geometry/projection helpers in `src/floor/`; UI in `src/components/floor/`.
`src/dev/` holds an experimental vector-based reimplementation.

### Other notable areas

- `src/components/ds/` — the in-house design-system primitives (Button, Badge,
  Ring, icons via SLDS sprites in `SfIcon.tsx`, etc.). Prefer these over ad-hoc
  markup.
- `src/components/error/` — error boundaries, the Panorama-styled dev error
  overlay (replaces Vite's default HMR overlay, which is disabled in
  `vite.config.ts`), and Vite error formatting.
- `src/settings/` — `Preferences` model (flat object in localStorage, sanitized on
  load), providers, and the settings modal.
- `src/dev/` — developer console (`devLog`) and experimental floor work.
- `src/utils/` — pure helpers (formatting, metrics, color, search, health
  insights). Keep these side-effect-free.

## Salesforce backend (`force-app/main/default/`)

- `classes/PanoramaRestHandler.cls` / `MiradorApi.cls` — the `@RestResource`
  entry point at `/mirador/v1/*`.
- `classes/Panorama*Service.cls` — domain services (agent, queue, skill, work,
  snapshot, capability) producing the response shapes in `src/api/types.ts`.
- `externalClientApps/` + `extlClntApp*OauthSets/` — ECA OAuth config for the SPA
  login flow.
- `skilltypes/` — `PanoramaLanguage`, `PanoramaExpertise` skill types.
- `*Test.cls` — Apex unit tests.

The HTTP contract is documented in [`docs/mirador-REST-API.md`](docs/mirador-REST-API.md);
auth setup in [`docs/salesforce-authentication.md`](docs/salesforce-authentication.md).
When you change the API on either side, update both ends **and** that doc.

Common Salesforce CLI commands: `sf project deploy start`,
`sf project retrieve start`, `sf apex run test`, `sf org open`.

## Conventions

- **Language:** UI strings, `devLog` messages, and some comments are in **Catalan**
  (`ca` is the default `lang`). Match the surrounding language of the file you edit.
- **Imports:** ESM only (`"type": "module"`). Use the existing relative-import
  style; there are no path aliases.
- **Styling:** plain CSS (`src/index.css`) + SLDS. No CSS-in-JS framework.
- **State:** React context per concern, split for render isolation (see the
  data/status split in `MiradorDataProvider`). No Redux/Zustand.
- **Lazy loading:** panels are code-split; keep heavy panels lazy.
- **Errors:** wrap risky UI in the shared `ErrorBoundary`; surface API failures
  through `MiradorStatusContext.error`.
- **Lint/format:** run `npm run lint` and respect Prettier (`.prettierrc`).
  `dist/`, `tmp/`, `public/`, `.sfdx/` are lint-ignored.

## Gotchas

- The dev server **must** be running for `/api/config`, `/api/oauth/token`, and the
  photo proxy to exist — the SPA can't authenticate from a bare static build.
- Real-data mode needs a configured `.env` and an org with the Apex REST deployed;
  use `npm run dev:mock` when you don't have that.
- `port 3000` is hard-coded for dev, preview, and the OAuth redirect URI — keep
  them aligned.
- The `dev` panel and `src/dev/` are explicitly experimental and removable; don't
  build production features on them.
