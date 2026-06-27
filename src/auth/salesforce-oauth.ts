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

async function refreshAccessSession(
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
  } catch {
    clearOAuthSession()
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
  } catch {
    clearOAuthSession()
    return null
  }
}

export async function startLogin(config?: PublicOAuthConfig): Promise<void> {
  const oauthConfig = config ?? (await fetchPublicConfig())
  if (!isSalesforceConfigured(oauthConfig)) {
    throw new OAuthError('SF_CLIENT_ID is not configured')
  }

  const verifier = generateCodeVerifier()
  const state = generateOAuthState()
  const challenge = await generateCodeChallenge(verifier)

  localStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  localStorage.setItem(PKCE_STATE_KEY, state)

  const redirectUri = resolveRedirectUri(oauthConfig)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: oauthConfig.sfClientId,
    redirect_uri: redirectUri,
    scope: 'api refresh_token offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  const loginUrl = `${oauthConfig.sfLoginUrl.replace(/\/$/, '')}/services/oauth2/authorize?${params}`
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

  if (!verifier || state !== storedState) {
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
  const response = await fetch(
    `${session.instanceUrl.replace(/\/$/, '')}/services/oauth2/userinfo`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  )

  if (!response.ok) {
    throw new OAuthError('Failed to load user info')
  }

  return (await response.json()) as SalesforceUserInfo
}

export function logout(): void {
  clearOAuthSession()
  localStorage.removeItem(PKCE_STATE_KEY)
  localStorage.removeItem(PKCE_VERIFIER_KEY)
  window.location.assign('/')
}

export function buildPhotoProxyUrlFromAbsoluteUrl(photoUrl: string): string {
  const parsed = new URL(photoUrl)
  return `/api/salesforce/photo?host=${encodeURIComponent(parsed.host)}&path=${encodeURIComponent(parsed.pathname)}`
}
