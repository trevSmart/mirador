# Salesforce org authentication

This document describes how the standalone web app authenticates against a Salesforce org. The flow is designed for a **public SPA** (no client secret in the browser) talking to **Apex REST** and standard Salesforce OAuth endpoints.

## Summary

| Aspect | Choice |
|--------|--------|
| Salesforce app type | **External Client App (ECA)** — not a legacy Connected App |
| OAuth flow | Authorization Code + **PKCE** (`S256`) |
| Scopes | `api`, `refresh_token`, `offline_access` |
| Client credentials | **Consumer Key only** (`SF_CLIENT_ID`); no consumer secret in the SPA or git |
| Token exchange | Browser → Vite dev server → Salesforce `/services/oauth2/token` |
| API access | `Authorization: Bearer <access_token>` to Apex REST and other Salesforce APIs |
| Session persistence | Encrypted in `localStorage`; refresh token used for silent renewal |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA)                                              │
│  · PKCE verifier + state (localStorage, transient)          │
│  · OAuth session encrypted (localStorage)                   │
│  · AES key (sessionStorage, tab-scoped)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ same origin
┌──────────────────────────▼──────────────────────────────────┐
│  Vite dev server (development)                              │
│  GET  /api/config          → public OAuth settings          │
│  POST /api/oauth/token     → proxies token exchange         │
│  GET  /api/salesforce/photo → proxies profile photos        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  Salesforce org                                             │
│  /services/oauth2/authorize · /services/oauth2/token        │
│  /services/apexrest/mirador/v1/... · /services/oauth2/userinfo │
└─────────────────────────────────────────────────────────────┘
```

The dev server holds **no business logic** and **no secrets** beyond what is already public (the Consumer Key). Its role is to avoid browser **CORS** blocks on `/services/oauth2/token` and to safely proxy authenticated photo requests.

## Configuration

Runtime OAuth settings come from `.env` (see `.env.example`) and are exposed to the browser as **public config** via `GET /api/config`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `SF_CLIENT_ID` | ECA Consumer Key | *(required for live data)* |
| `SF_LOGIN_URL` | Auth host | `https://login.salesforce.com` (use `https://test.salesforce.com` for sandboxes) |
| `SF_REDIRECT_URI` | Registered callback | `http://localhost:3000/oauth/callback` |

The SPA also derives `sfRedirectUri` from `window.location.origin` when config does not override it.

**Important:** The app must be served through the Vite dev server (`npm run dev`). Opening static files directly breaks `/api/config` and `/api/oauth/token`.

## Related files

| Area | Location |
|------|----------|
| OAuth client (PKCE, login, refresh) | `src/auth/salesforce-oauth.ts` |
| Encrypted session storage | `src/auth/oauth-session-storage.ts` |
| Token proxy | `src/server/oauth-token-proxy.ts` |
| Photo proxy | `src/server/salesforce-photo-proxy.ts` |
| Env / public config | `src/server/load-env.ts`, `.env.example` |
| App bootstrap (callback + ensure auth) | `src/App.tsx` |
| Apex REST client + session recovery | `src/api/mirador-client.ts` |
