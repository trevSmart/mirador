# Mirador

Mirador is a contact-center observability dashboard. A React 19 + Vite single-page
app surfaces a live view of agents, queues, skills, and work items, reading a
domain-oriented JSON API served by Apex REST from a Salesforce org.

The repository is a dual project:

- **`src/`** — the SPA (TypeScript, React 19, Vite 8).
- **`force-app/`** — the Salesforce DX metadata: Apex classes implementing the REST
  API, External Client App (ECA) OAuth definitions, and skill types.

> Working in this repo with an AI agent? See [AGENTS.md](AGENTS.md) for the
> architecture map and conventions.

## Quick start

```bash
npm install
npm run dev:mock     # run the UI with mock data — no Salesforce org needed
```

Then open http://localhost:3000.

To run against a real org, create a `.env` (see `.env.example`) and use
`npm run dev` instead — this requires the Apex REST API deployed to your org and a
configured External Client App.

## Data sources: mock vs. Salesforce

The app runs against either mock data or a real Salesforce org. Resolution order:

1. Server env `MIRADOR_DATA_SOURCE` (`mock` | `salesforce`, default `salesforce`),
   exposed to the SPA via `GET /api/config`.
2. The user preference `mockOverride` (Settings modal) can force mock at runtime.

In mock mode no authentication is required; the app uses a self-contained fake
backend in `src/api/mock/`. Use `npm run dev:mock` to develop UI without an org.

## Scripts

```bash
npm run dev          # Vite dev server on :3000 (real Salesforce data by default)
npm run dev:mock     # dev server forced to mock data
npm run build        # tsc -b && vite build
npm run preview      # serve the production build on :3000
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run knip         # report unused files/exports/deps
npm run precommit    # lint (run by the Husky pre-commit hook)
npm run stop         # kill the dev server
```

Type-checking runs as part of `npm run build` (`tsc -b`).

## Architecture (frontend)

The app is a tree of React context providers (see `src/App.tsx`):
preferences → auth → API client → data → dockview host → drawers/modals → UI.

- **`src/api/`** — typed REST client (`mirador-client.ts`), domain contracts
  (`types.ts`), the mock backend (`mock/`), and the **Data Service layer**
  (`data-service/` + `data-hooks.ts`): a TanStack Query cache that loads a
  snapshot, polls in the background, dedups requests, and serves the UI through
  hooks like `useAgents` / `useDataStatus`.
- **`src/auth/`** — OAuth 2.0 Authorization Code + PKCE against a Salesforce
  External Client App (public SPA flow, no client secret in the browser).
- **`src/server/`** — Vite dev-server middleware serving `/api/config`,
  `/api/oauth/token` (token proxy), and `/api/salesforce/photo` (photo proxy).
- **`src/panels/` + `src/dockview/`** — the dockable workspace. `registry.ts` is the
  single source of truth for panels (home, wallboard, agents, queues, skills, work,
  space, space editor, and an experimental dev panel).
- **`src/space/` + `src/components/space/`** — 2D/3D isometric space plan.
- **`src/components/ds/`** — in-house design-system primitives (SLDS-based).
- **`src/settings/`** — user preferences (persisted to localStorage) and the
  settings modal.

The dev server must be running for the `/api/*` endpoints to exist — the SPA cannot
authenticate from a bare static build.

## Salesforce backend (`force-app/main/default/`)

- `classes/` — the Apex REST entry point (`MiradorRestHandler` / `MiradorApi`,
  mapped to `/mirador/v1/*`) and the domain services that produce the response
  shapes consumed by the SPA.
- `externalClientApps/` + `extlClntApp*OauthSets/` — ECA OAuth configuration.
- `skilltypes/` — `MiradorLanguage` and `MiradorExpertise` skill types.

The HTTP contract is documented in [docs/mirador-REST-API.md](docs/mirador-REST-API.md);
authentication setup in [docs/salesforce-authentication.md](docs/salesforce-authentication.md).

Common Salesforce CLI commands:

```bash
sf org login web                 # authorize an org
sf project deploy start          # deploy metadata
sf project retrieve start        # retrieve metadata
sf apex run test                 # run Apex tests
sf org open                      # open the org in a browser
```

## Tech stack

React 19 (with the React Compiler), Vite 8, TypeScript, `dockview-react`,
TanStack Query v5, ESLint 10, Prettier, Knip, Vitest. Backend: Salesforce Apex
(API version 66.0).

## Third-party licenses

Salesforce Lightning Design System (SLDS) — v2.30.7.

- **Source** (CSS, SCSS, design tokens): Copyright (c) 2015, Salesforce.com, Inc.
  Licensed under the [BSD 3-Clause License](https://git.io/sfdc-license).
- **Icons and images**: Copyright (c) 2015, Salesforce.com, Inc. Licensed under
  [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/). Icons may be
  redistributed without modification. Credit:
  [Salesforce Lightning Design System](https://v1.lightningdesignsystem.com).
