import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchPublicConfig,
  fetchUserInfo,
  getValidAccessSession,
  isSalesforceConfigured,
  logout as oauthLogout,
  startLogin,
} from './salesforce-oauth'
import { initOAuthSessionStorage } from './oauth-session-storage'
import { MOCK_USER_INFO } from '../api/mock/mock-user'
import { isMockMode } from '../config/data-source'
import type { OAuthSession, PublicOAuthConfig, SalesforceUserInfo } from './types'
import { OAuthError } from './types'

const MOCK_SESSION: OAuthSession = {
  accessToken: 'mock-access-token',
  refreshToken: '',
  instanceUrl: 'https://mock.local',
  expiresAt: Number.MAX_SAFE_INTEGER,
}

interface AuthContextValue {
  config: PublicOAuthConfig | null
  session: OAuthSession | null
  userInfo: SalesforceUserInfo | null
  isAuthenticated: boolean
  isMockMode: boolean
  isSalesforceEnabled: boolean
  isLoading: boolean
  authError: string | null
  login: () => Promise<void>
  logout: () => void
  refreshSession: () => Promise<OAuthSession | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  initialAuthError = null,
}: {
  children: ReactNode
  initialAuthError?: string | null
}) {
  const [config, setConfig] = useState<PublicOAuthConfig | null>(null)
  const [session, setSession] = useState<OAuthSession | null>(null)
  const [userInfo, setUserInfo] = useState<SalesforceUserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(initialAuthError)

  const refreshSession = useCallback(async () => {
    const nextSession = await getValidAccessSession()
    setSession(nextSession)
    return nextSession
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const publicConfig = await fetchPublicConfig()
        if (cancelled) return
        setConfig(publicConfig)

        if (isMockMode(publicConfig)) {
          setSession(MOCK_SESSION)
          setUserInfo(MOCK_USER_INFO)
        } else {
          await initOAuthSessionStorage()

          const existingSession = await getValidAccessSession()
          if (cancelled) return
          setSession(existingSession)
        }
      } catch (error) {
        if (cancelled) return
        if (error instanceof OAuthError) {
          setAuthError(error.message)
        } else {
          setAuthError('Failed to initialize authentication')
        }
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

  useEffect(() => {
    if (!session || isMockMode(config)) {
      if (!isMockMode(config)) {
        setUserInfo(null)
      }
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
  }, [config, session])

  const login = useCallback(async () => {
    if (isMockMode(config)) {
      return
    }
    setAuthError(null)
    try {
      await startLogin(config ?? undefined)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    }
  }, [config])

  // Auto-login on startup: once bootstrap has settled, if Salesforce is
  // configured but there's no session, kick off the OAuth redirect. Skipped
  // when an auth error is present (e.g. we just bounced back from a failed or
  // cancelled login) so we never loop redirect → error → redirect. Guarded to
  // fire at most once per mount.
  const autoLoginAttempted = useRef(false)
  useEffect(() => {
    if (autoLoginAttempted.current) return
    if (isLoading || session || authError) return
    if (!config || isMockMode(config) || !isSalesforceConfigured(config)) return

    autoLoginAttempted.current = true
    void login()
  }, [authError, config, isLoading, login, session])

  const logout = useCallback(() => {
    oauthLogout()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      config,
      session,
      userInfo,
      isAuthenticated: Boolean(session),
      isMockMode: isMockMode(config),
      isSalesforceEnabled: config ? isSalesforceConfigured(config) : false,
      isLoading,
      authError,
      login,
      logout,
      refreshSession,
    }),
    [
      authError,
      config,
      isLoading,
      login,
      logout,
      refreshSession,
      session,
      userInfo,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
