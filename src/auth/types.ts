export interface OAuthSession {
  accessToken: string
  refreshToken: string
  instanceUrl: string
  expiresAt: number
}

export interface PublicOAuthConfig {
  sfClientId: string
  sfLoginUrl: string
  sfRedirectUri: string
}

export interface SalesforceUserInfo {
  sub: string
  user_id: string
  organization_id: string
  name: string
  email?: string
  picture?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  instance_url: string
  issued_at?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export class OAuthError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'OAuthError'
    this.code = code
  }
}
