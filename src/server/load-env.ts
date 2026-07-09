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
  if (loginUrl.includes('test.salesforce.com')) {
    return 'https://test.salesforce.com'
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
