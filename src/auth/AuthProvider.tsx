import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'
import {
  fetchPublicConfig,
  fetchUserInfo,
  getValidAccessSession,
  isSalesforceConfigured,
  logout as oauthLogout,
  startLogin,
} from './salesforce-oauth'
import { initOAuthSessionStorage, subscribeOAuthSession } from './oauth-session-storage'
import { MOCK_USER_INFO } from '../api/mock/mock-user'
import { devLog } from '../dev/dev-log'
import { isMockMode as isServerMockConfig } from '../config/data-source'
import { usePreferences } from '../settings/preferences-context'
import type { OAuthSession, PublicOAuthConfig, SalesforceUserInfo } from './types'
import { OAuthError } from './types'

const MOCK_SESSION: OAuthSession = {
  accessToken: 'mock-access-token',
  refreshToken: '',
  instanceUrl: 'https://mock.local',
  expiresAt: Number.MAX_SAFE_INTEGER,
}

export function AuthProvider({
  children,
  initialAuthError = null,
}: {
  children: ReactNode
  initialAuthError?: string | null
}) {
  const { prefs } = usePreferences()
  const [config, setConfig] = useState<PublicOAuthConfig | null>(null)
  const [session, setSession] = useState<OAuthSession | null>(null)
  const [userInfo, setUserInfo] = useState<SalesforceUserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(initialAuthError)

  const isServerMockMode = isServerMockConfig(config)
  const isMockMode = isServerMockMode || prefs.mockOverride

  // The client layer replaces or clears the stored session outside React
  // (token refresh in getValidAccessSession, recovery in mirador-client,
  // logout), so track the storage-level session to keep the context — and
  // every Bearer token consumers derive from it — from going stale.
  useEffect(() => subscribeOAuthSession(setSession), [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const publicConfig = await fetchPublicConfig()
        if (cancelled) return
        setConfig(publicConfig)

        if (isServerMockConfig(publicConfig)) {
          devLog.action('auth:bootstrap', 'mock mode')
          setUserInfo(MOCK_USER_INFO)
        } else {
          await initOAuthSessionStorage()

          const existingSession = await getValidAccessSession()
          if (cancelled) return
          devLog.action('auth:bootstrap', existingSession ? 'session restored' : 'no session')
          setSession(existingSession)
        }
      } catch (error) {
        if (cancelled) return
        const message = error instanceof OAuthError ? error.message : 'Failed to initialize authentication'
        console.error('[auth:bootstrap] failed:', message)
        setAuthError(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  // Clear a stale profile once the real session is gone. Simulation mode always
  // exposes MOCK_USER_INFO regardless of stored session state.
  if (!session && userInfo !== null && !isMockMode) {
    setUserInfo(null)
  }

  useEffect(() => {
    if (!session || isMockMode) {
      return
    }

    let cancelled = false
    void fetchUserInfo(session)
      .then((info) => {
        if (!cancelled) {
          setUserInfo(info)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserInfo(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isMockMode, session])

  const login = useCallback(async (options?: { forceAccountSelection?: boolean }) => {
    if (isMockMode) {
      return
    }
    setAuthError(null)
    devLog.action('auth:login', 'redirecting to Salesforce')
    try {
      await startLogin(config ?? undefined, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      console.error('[auth:login] failed:', message)
      setAuthError(message)
    }
  }, [config, isMockMode])

  // Auto-login on startup: once bootstrap has settled, if Salesforce is
  // configured but there's no session, kick off the OAuth redirect. Skipped
  // when an auth error is present (e.g. we just bounced back from a failed or
  // cancelled login) so we never loop redirect → error → redirect. Guarded to
  // fire at most once per mount.
  const autoLoginAttempted = useRef(false)
  useEffect(() => {
    if (autoLoginAttempted.current) return
    if (isLoading || session || authError || isMockMode) return
    if (!config || !isSalesforceConfigured(config)) return

    autoLoginAttempted.current = true
    queueMicrotask(() => {
      void login()
    })
  }, [authError, config, isLoading, isMockMode, login, session])

  const logout = useCallback(() => {
    devLog.action('auth:logout')
    oauthLogout(session)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      config,
      session: isMockMode ? MOCK_SESSION : session,
      userInfo: isMockMode ? MOCK_USER_INFO : userInfo,
      isAuthenticated: isMockMode || Boolean(session),
      isMockMode,
      isServerMockMode,
      isSalesforceEnabled: config ? isSalesforceConfigured(config) : false,
      isLoading,
      authError,
      login,
      logout,
    }),
    [
      authError,
      config,
      isLoading,
      isMockMode,
      isServerMockMode,
      login,
      logout,
      session,
      userInfo,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
