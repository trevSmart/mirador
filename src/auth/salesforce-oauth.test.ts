import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  fetchUserInfo,
  getValidAccessSession,
  recoverAccessSession,
} from './salesforce-oauth'
import {
  clearOAuthSession,
  getCachedOAuthSession,
  saveOAuthSession,
  subscribeOAuthSession,
} from './oauth-session-storage'
import type { OAuthSession, PublicOAuthConfig } from './types'

const config: PublicOAuthConfig = {
  sfClientId: 'CID',
  sfLoginUrl: 'https://login.salesforce.com',
  sfRedirectUri: 'http://localhost:3000/oauth/callback',
}

describe('buildAuthorizeUrl', () => {
  it('omits prompt when account selection is not forced', () => {
    const url = new URL(
      buildAuthorizeUrl(config, { challenge: 'CH', state: 'ST' }),
    )
    expect(url.searchParams.has('prompt')).toBe(false)
    expect(url.searchParams.get('client_id')).toBe('CID')
    expect(url.searchParams.get('code_challenge')).toBe('CH')
    expect(url.searchParams.get('state')).toBe('ST')
    expect(url.pathname).toBe('/services/oauth2/authorize')
  })

  it('adds prompt=login when account selection is forced', () => {
    const url = new URL(
      buildAuthorizeUrl(config, {
        challenge: 'CH',
        state: 'ST',
        forceAccountSelection: true,
      }),
    )
    expect(url.searchParams.get('prompt')).toBe('login')
  })

  it('uses the configured redirect uri', () => {
    const url = new URL(
      buildAuthorizeUrl(config, { challenge: 'CH', state: 'ST' }),
    )
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/oauth/callback',
    )
  })
})

describe('buildLogoutUrl', () => {
  // /services/oauth2/logout is the OIDC single-logout endpoint: it only exists
  // when an org explicitly enables single logout, and 404s otherwise. The
  // classic /secur/logout.jsp endpoint universally ends the browser session
  // and is what actually breaks the "stuck on the wrong org" loop.
  //
  // Crucially it must target the org's My Domain host — the session's
  // instanceUrl — because that is where the Salesforce browser session cookie
  // lives. Hitting login.salesforce.com instead leaves the My Domain session
  // alive and the next auto-login silently re-authenticates through it.
  it('points at the classic Salesforce logout page of the instance host', () => {
    expect(buildLogoutUrl('https://x.my.salesforce.com')).toBe(
      'https://x.my.salesforce.com/secur/logout.jsp?retURL=%2F',
    )
  })

  it('does not double up the slash when the instance url has a trailing slash', () => {
    expect(buildLogoutUrl('https://x.my.salesforce.com/')).toBe(
      'https://x.my.salesforce.com/secur/logout.jsp?retURL=%2F',
    )
  })
})

function makeExpiredSession(overrides: Partial<OAuthSession> = {}): OAuthSession {
  return {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    instanceUrl: 'https://org.my.salesforce.com',
    expiresAt: Date.now() - 1_000,
    ...overrides,
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

const REFRESHED_TOKEN_RESPONSE = {
  access_token: 'new-access',
  refresh_token: 'rotated-refresh',
  instance_url: 'https://org.my.salesforce.com',
  issued_at: String(Date.now()),
  expires_in: 7_200,
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  clearOAuthSession()
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getValidAccessSession', () => {
  // With refresh-token rotation, parallel refresh_token grants mean only the
  // first wins; the losers come back invalid_grant and spuriously log the
  // user out. Concurrent callers must share a single in-flight refresh.
  it('deduplicates concurrent refreshes into a single token request', async () => {
    await saveOAuthSession(makeExpiredSession())
    fetchMock.mockResolvedValue(jsonResponse(REFRESHED_TOKEN_RESPONSE))

    const [first, second] = await Promise.all([
      getValidAccessSession(),
      getValidAccessSession(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first?.accessToken).toBe('new-access')
    expect(first?.refreshToken).toBe('rotated-refresh')
    expect(second).toEqual(first)
  })

  // A transient failure (network down, proxy unreachable) says nothing about
  // the refresh token itself — destroying the stored session here forces a
  // pointless re-login even though the token is still perfectly valid.
  it('keeps the stored session when the refresh fails with a network error', async () => {
    const session = makeExpiredSession()
    await saveOAuthSession(session)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await getValidAccessSession()

    expect(result).toBeNull()
    expect(getCachedOAuthSession()).toEqual(session)
    expect(localStorage.getItem('mirador_oauth_session')).not.toBeNull()
  })

  it('clears the stored session when the refresh is rejected with invalid_grant', async () => {
    await saveOAuthSession(makeExpiredSession())
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'invalid_grant', error_description: 'expired access/refresh token' },
        false,
        400,
      ),
    )

    const result = await getValidAccessSession()

    expect(result).toBeNull()
    expect(getCachedOAuthSession()).toBeNull()
    expect(localStorage.getItem('mirador_oauth_session')).toBeNull()
  })
})

describe('recoverAccessSession', () => {
  it('keeps the stored session when the refresh fails with a network error', async () => {
    const session = makeExpiredSession()
    await saveOAuthSession(session)
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await recoverAccessSession()

    expect(result).toBeNull()
    expect(getCachedOAuthSession()).toEqual(session)
    expect(localStorage.getItem('mirador_oauth_session')).not.toBeNull()
  })

  it('clears the stored session when the refresh is rejected with invalid_grant', async () => {
    await saveOAuthSession(makeExpiredSession())
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'invalid_grant', error_description: 'expired access/refresh token' },
        false,
        400,
      ),
    )

    const result = await recoverAccessSession()

    expect(result).toBeNull()
    expect(getCachedOAuthSession()).toBeNull()
    expect(localStorage.getItem('mirador_oauth_session')).toBeNull()
  })
})

describe('fetchUserInfo', () => {
  // The org's userinfo endpoint is CORS-blocked for the app origin, so the
  // request must go through the same-origin server proxy (like the token and
  // photo proxies), never straight to the instance host.
  it('requests the same-origin userinfo proxy, not the instance host', async () => {
    const session = makeExpiredSession({ expiresAt: Date.now() + 3_600_000 })
    fetchMock.mockResolvedValue(
      jsonResponse({
        sub: 'https://login.salesforce.com/id/00D/005',
        user_id: '005xx0000000001',
        organization_id: '00Dxx0000000001',
        name: 'Ada Lovelace',
      }),
    )

    const info = await fetchUserInfo(session)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/oauth/userinfo?host=org.my.salesforce.com')
    expect(init?.headers).toEqual({ Authorization: 'Bearer old-access' })
    expect(info.name).toBe('Ada Lovelace')
  })
})

describe('subscribeOAuthSession', () => {
  // The client layer replaces/clears the stored session outside React (token
  // refresh, recovery, logout); subscribers — the AuthProvider — must be told
  // so the context session never goes stale.
  it('notifies with the refreshed session after a successful refresh', async () => {
    await saveOAuthSession(makeExpiredSession())
    fetchMock.mockResolvedValue(jsonResponse(REFRESHED_TOKEN_RESPONSE))
    const listener = vi.fn()
    const unsubscribe = subscribeOAuthSession(listener)

    await getValidAccessSession()

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'new-access' }),
    )
    unsubscribe()
  })

  it('notifies with null after the session is cleared', async () => {
    await saveOAuthSession(makeExpiredSession())
    const listener = vi.fn()
    const unsubscribe = subscribeOAuthSession(listener)

    clearOAuthSession()

    expect(listener).toHaveBeenCalledWith(null)
    unsubscribe()
  })

  it('stops notifying once unsubscribed', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeOAuthSession(listener)
    unsubscribe()

    await saveOAuthSession(makeExpiredSession())
    clearOAuthSession()

    expect(listener).not.toHaveBeenCalled()
  })
})
