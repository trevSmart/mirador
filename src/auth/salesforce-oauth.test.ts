import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, buildLogoutUrl } from './salesforce-oauth'
import type { PublicOAuthConfig } from './types'

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
