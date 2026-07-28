import {
  clearOAuthSession,
  getCachedOAuthSession,
  initOAuthSessionStorage,
  isSessionValid,
  saveOAuthSession,
} from './oauth-session-storage'
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  hashOAuthState,
  PKCE_STATE_KEY,
  PKCE_VERIFIER_KEY,
} from './pkce'
import type {
  OAuthSession,
  PublicOAuthConfig,
  SalesforceUserInfo,
  TokenResponse,
} from './types'
import { OAuthError } from './types'

const TOKEN_PROXY_URL = '/api/oauth/token'
const CONFIG_URL = '/api/config'
const MAX_RETRIES = 3

let publicConfig: PublicOAuthConfig | null = null

function resolveRedirectUri(config: PublicOAuthConfig): string {
  if (config.sfRedirectUri) {
    return config.sfRedirectUri
  }
  return `${window.location.origin}/oauth/callback`
}

export function buildAuthorizeUrl(
  config: PublicOAuthConfig,
  options: { challenge: string; state: string; forceAccountSelection?: boolean },
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.sfClientId,
    redirect_uri: resolveRedirectUri(config),
    scope: 'api refresh_token offline_access',
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
  })
  // prompt=login forces Salesforce to show the login/org picker even when the
  // browser already has an active session. This is the escape hatch out of the
  // "wrong org" loop: without it, Salesforce silently reuses the existing
  // session and keeps landing on an org where the ECA may not be installed.
  if (options.forceAccountSelection) {
    params.set('prompt', 'login')
  }
  return `${config.sfLoginUrl.replace(/\/$/, '')}/services/oauth2/authorize?${params}`
}

export function buildLogoutUrl(instanceUrl: string): string {
  // /secur/logout.jsp (not /services/oauth2/logout, which 404s unless an org
  // explicitly enables OIDC single logout) is the classic endpoint that
  // universally ends the browser's Salesforce session. Without retURL it
  // redirects to the salesforce.com marketing site; retURL=/ sends the user
  // back to the login form on the same host instead, so they land somewhere
  // useful to pick the right org/account.
  //
  // It MUST hit the org's My Domain host (the session's instanceUrl), because
  // that is where the Salesforce session cookie lives. Hitting sfLoginUrl
  // (login.salesforce.com) instead ends a session that isn't the one keeping
  // the user logged in, so auto-login silently re-authenticates through the
  // still-alive My Domain session.
  const params = new URLSearchParams({ retURL: '/' })
  return `${instanceUrl.replace(/\/$/, '')}/secur/logout.jsp?${params}`
}

function sessionFromTokenResponse(data: TokenResponse, previous?: OAuthSession): OAuthSession {
  const issuedAt = data.issued_at ? Number(data.issued_at) : Date.now()
  const expiresIn = data.expires_in ?? 7_200
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? previous?.refreshToken ?? '',
    instanceUrl: data.instance_url,
    expiresAt: issuedAt + expiresIn * 1000,
  }
}

async function postTokenProxy(body: Record<string, string>): Promise<TokenResponse> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(TOKEN_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as TokenResponse
      if (!response.ok) {
        const oauthError = new OAuthError(
          data.error_description ?? data.error ?? 'Token exchange failed',
          data.error,
        )
        // 4xx are deterministic OAuth failures (e.g. invalid_grant). Retrying
        // is pointless and harmful: an authorization_code is single-use, so a
        // retry resends an already-consumed code and masks the real error.
        // Only transient 5xx responses are worth retrying.
        if (response.status < 500) {
          throw oauthError
        }
        lastError = oauthError
      } else {
        return data
      }
    } catch (error) {
      // OAuthError from a 4xx is final — propagate without retrying.
      if (error instanceof OAuthError) {
        throw error
      }
      lastError = error instanceof Error ? error : new Error('Network error')
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }

  throw lastError ?? new OAuthError('Token exchange failed after retries')
}

export async function fetchPublicConfig(): Promise<PublicOAuthConfig> {
  if (publicConfig) {
    return publicConfig
  }

  const response = await fetch(CONFIG_URL)
  if (!response.ok) {
    throw new OAuthError('Failed to load OAuth config. Run npm run dev.')
  }

  publicConfig = (await response.json()) as PublicOAuthConfig
  return publicConfig
}

export function isSalesforceConfigured(config: PublicOAuthConfig): boolean {
  return Boolean(config.sfClientId)
}

function refreshAccessSession(session: OAuthSession): Promise<OAuthSession> {
  // Deduplicate concurrent refreshes (same pattern as pendingOAuthCallback):
  // with refresh-token rotation, parallel refresh_token grants mean only the
  // first wins and every loser gets invalid_grant → spurious logout.
  if (pendingSessionRefresh) {
    return pendingSessionRefresh
  }

  pendingSessionRefresh = performSessionRefresh(session).finally(() => {
    pendingSessionRefresh = null
  })

  return pendingSessionRefresh
}

let pendingSessionRefresh: Promise<OAuthSession> | null = null

async function performSessionRefresh(
  session: OAuthSession,
): Promise<OAuthSession> {
  if (!session.refreshToken) {
    throw new OAuthError('No refresh token available', 'invalid_grant')
  }

  const data = await postTokenProxy({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  })
  const nextSession = sessionFromTokenResponse(data, session)
  await saveOAuthSession(nextSession)
  return nextSession
}

export async function getValidAccessSession(): Promise<OAuthSession | null> {
  let session = getCachedOAuthSession() ?? (await initOAuthSessionStorage())
  if (!session) {
    return null
  }

  if (isSessionValid(session)) {
    return session
  }

  try {
    session = await refreshAccessSession(session)
    return isSessionValid(session) ? session : null
  } catch (error) {
    // Only a definitive OAuth rejection (e.g. invalid_grant) means the
    // refresh token is dead. A transient network failure says nothing about
    // it, so keep the stored session for the next attempt instead of forcing
    // a re-login.
    if (error instanceof OAuthError) {
      clearOAuthSession()
    }
    return null
  }
}

export async function recoverAccessSession(): Promise<OAuthSession | null> {
  const session = getCachedOAuthSession() ?? (await initOAuthSessionStorage())
  if (!session?.refreshToken) {
    clearOAuthSession()
    return null
  }

  try {
    const refreshed = await refreshAccessSession(session)
    return isSessionValid(refreshed) ? refreshed : null
  } catch (error) {
    // Same as getValidAccessSession: only clear on a definitive OAuth
    // rejection, never on a transient network failure.
    if (error instanceof OAuthError) {
      clearOAuthSession()
    }
    return null
  }
}

export async function startLogin(
  config?: PublicOAuthConfig,
  options: { forceAccountSelection?: boolean } = {},
): Promise<void> {
  const oauthConfig = config ?? (await fetchPublicConfig())
  if (!isSalesforceConfigured(oauthConfig)) {
    throw new OAuthError('SF_CLIENT_ID is not configured')
  }

  const verifier = generateCodeVerifier()
  const state = generateOAuthState()
  const challenge = await generateCodeChallenge(verifier)

  localStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  localStorage.setItem(PKCE_STATE_KEY, await hashOAuthState(state))

  const loginUrl = buildAuthorizeUrl(oauthConfig, {
    challenge,
    state,
    forceAccountSelection: options.forceAccountSelection,
  })
  window.location.assign(loginUrl)
}

export async function handleOAuthCallback(): Promise<OAuthSession> {
  if (pendingOAuthCallback) {
    return pendingOAuthCallback
  }

  pendingOAuthCallback = completeOAuthCallback().finally(() => {
    pendingOAuthCallback = null
  })

  return pendingOAuthCallback
}

let pendingOAuthCallback: Promise<OAuthSession> | null = null

async function completeOAuthCallback(): Promise<OAuthSession> {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) {
    clearOAuthSession()
    throw new OAuthError(
      errorDescription ?? error,
      error,
    )
  }

  const code = params.get('code')
  const state = params.get('state')
  const storedState = localStorage.getItem(PKCE_STATE_KEY)
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY)

  if (!code || !state) {
    clearOAuthSession()
    throw new OAuthError('Invalid OAuth callback state')
  }

  if (!verifier || (await hashOAuthState(state)) !== storedState) {
    // Discard the stale PKCE material on a mismatched/replayed callback so it
    // can't linger at rest or interfere with a later legitimate login.
    localStorage.removeItem(PKCE_STATE_KEY)
    localStorage.removeItem(PKCE_VERIFIER_KEY)
    const existingSession = await getValidAccessSession()
    if (existingSession) {
      return existingSession
    }
    clearOAuthSession()
    throw new OAuthError('Invalid OAuth callback state')
  }

  localStorage.removeItem(PKCE_STATE_KEY)
  localStorage.removeItem(PKCE_VERIFIER_KEY)

  const config = await fetchPublicConfig()
  const data = await postTokenProxy({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: resolveRedirectUri(config),
  })

  const session = sessionFromTokenResponse(data)
  await saveOAuthSession(session)
  return session
}

export async function fetchUserInfo(session: OAuthSession): Promise<SalesforceUserInfo> {
  // The org's userinfo endpoint has no CORS allowlist entry for this app, so a
  // direct browser call is blocked. Go through the same-origin server proxy
  // instead (like the token and photo proxies), which forwards the request to
  // the instance host.
  const host = new URL(session.instanceUrl).host
  const response = await fetch(
    `/api/oauth/userinfo?host=${encodeURIComponent(host)}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  )

  if (!response.ok) {
    throw new OAuthError('Failed to load user info')
  }

  return (await response.json()) as SalesforceUserInfo
}

export function logout(session: OAuthSession | null): void {
  const instanceUrl = session?.instanceUrl
  clearOAuthSession()
  localStorage.removeItem(PKCE_STATE_KEY)
  localStorage.removeItem(PKCE_VERIFIER_KEY)
  // A local-only logout leaves the Salesforce browser session intact, so the
  // next auto-login silently reuses it and lands the user right back where they
  // were. When we know the org's My Domain host (the session's instanceUrl),
  // bounce through Salesforce's logout endpoint to drop that session too;
  // otherwise fall back to a plain in-app reset.
  if (instanceUrl) {
    window.location.assign(buildLogoutUrl(instanceUrl))
    return
  }
  window.location.assign('/')
}

export function buildPhotoProxyUrlFromAbsoluteUrl(photoUrl: string): string {
  const parsed = new URL(photoUrl)
  return `/api/salesforce/photo?host=${encodeURIComponent(parsed.host)}&path=${encodeURIComponent(parsed.pathname)}`
}
