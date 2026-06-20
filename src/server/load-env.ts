export interface ServerEnv {
  sfClientId: string
  sfLoginUrl: string
  sfRedirectUri: string
}

export function loadServerEnv(): ServerEnv {
  return {
    sfClientId: process.env.SF_CLIENT_ID ?? '',
    sfLoginUrl: process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com',
    sfRedirectUri:
      process.env.SF_REDIRECT_URI ?? 'http://localhost:3000/oauth/callback',
  }
}

export function getPublicConfig(env: ServerEnv) {
  return {
    sfClientId: env.sfClientId,
    sfLoginUrl: env.sfLoginUrl,
    sfRedirectUri: env.sfRedirectUri,
  }
}
