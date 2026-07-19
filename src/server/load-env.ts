export interface ServerEnv {
  sfClientId: string
  sfLoginUrl: string
  sfTokenUrl: string
  sfRedirectUri: string
  dataSource: 'mock' | 'salesforce'
}

/** OAuth token exchange always uses the global auth host, not My Domain. */
function resolveSfTokenUrl(loginUrl: string): string {
  if (process.env.SF_TOKEN_URL) {
    return process.env.SF_TOKEN_URL.replace(/\/$/, '')
  }
  try {
    const { hostname } = new URL(loginUrl)
    if (hostname === 'test.salesforce.com' || hostname.endsWith('.test.salesforce.com')) {
      return 'https://test.salesforce.com'
    }
  } catch {
    // Invalid URL falls through to default
  }
  return 'https://login.salesforce.com'
}

export function loadServerEnv(): ServerEnv {
  const dataSource =
    process.env.MIRADOR_DATA_SOURCE === 'mock' ? 'mock' : 'salesforce'
  const sfLoginUrl = process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com'

  return {
    sfClientId: process.env.SF_CLIENT_ID ?? '',
    sfLoginUrl,
    sfTokenUrl: resolveSfTokenUrl(sfLoginUrl),
    sfRedirectUri:
      process.env.SF_REDIRECT_URI ?? 'http://localhost:3000/oauth/callback',
    dataSource,
  }
}

export function getPublicConfig(env: ServerEnv) {
  return {
    sfClientId: env.sfClientId,
    sfLoginUrl: env.sfLoginUrl,
    sfRedirectUri: env.sfRedirectUri,
    dataSource: env.dataSource,
  }
}
