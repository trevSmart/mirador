import { initOAuthSessionStorage } from './oauth-session-storage'
import {
  fetchPublicConfig,
  getValidAccessSession,
  handleOAuthCallback,
} from './salesforce-oauth'
import { OAuthError } from './types'

export interface AuthBootstrapResult {
  authError: string | null
}

function isOAuthCallbackPath(): boolean {
  return window.location.pathname === '/oauth/callback'
}

function replaceAppPath(): void {
  window.history.replaceState({}, '', '/')
}

export async function bootstrapAuth(): Promise<AuthBootstrapResult> {
  await initOAuthSessionStorage()

  if (!isOAuthCallbackPath()) {
    return { authError: null }
  }

  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('error')
  const oauthErrorDescription = params.get('error_description')

  if (oauthError) {
    replaceAppPath()
    return {
      authError: oauthErrorDescription ?? oauthError,
    }
  }

  if (!params.has('code')) {
    replaceAppPath()
    return { authError: null }
  }

  try {
    await handleOAuthCallback()
    replaceAppPath()
    return { authError: null }
  } catch (error) {
    replaceAppPath()

    const existingSession = await getValidAccessSession()
    if (existingSession) {
      return { authError: null }
    }

    if (error instanceof OAuthError) {
      return { authError: error.message }
    }

    return { authError: 'Failed to complete Salesforce login' }
  }
}

export async function preloadPublicConfig(): Promise<void> {
  await fetchPublicConfig()
}
