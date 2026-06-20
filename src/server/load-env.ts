export interface ServerEnv {
  sfClientId: string
  sfLoginUrl: string
  sfRedirectUri: string
  dataSource: 'mock' | 'salesforce'
}

export function loadServerEnv(): ServerEnv {
  const dataSource =
    process.env.MIRADOR_DATA_SOURCE === 'mock' ? 'mock' : 'salesforce'

  return {
    sfClientId: process.env.SF_CLIENT_ID ?? '',
    sfLoginUrl: process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com',
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
