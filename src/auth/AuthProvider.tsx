import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchPublicConfig,
  fetchUserInfo,
  getValidAccessSession,
  handleOAuthCallback,
  isSalesforceConfigured,
  logout as oauthLogout,
  startLogin,
} from './salesforce-oauth'
import { initOAuthSessionStorage } from './oauth-session-storage'
import type { OAuthSession, PublicOAuthConfig, SalesforceUserInfo } from './types'
import { OAuthError } from './types'

interface AuthContextValue {
  config: PublicOAuthConfig | null
  session: OAuthSession | null
  userInfo: SalesforceUserInfo | null
  isAuthenticated: boolean
  isSalesforceEnabled: boolean
  isLoading: boolean
  authError: string | null
  login: () => Promise<void>
  logout: () => void
  refreshSession: () => Promise<OAuthSession | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicOAuthConfig | null>(null)
  const [session, setSession] = useState<OAuthSession | null>(null)
  const [userInfo, setUserInfo] = useState<SalesforceUserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

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

        await initOAuthSessionStorage()

        if (window.location.pathname === '/oauth/callback') {
          const callbackSession = await handleOAuthCallback()
          if (cancelled) return
          setSession(callbackSession)
          window.history.replaceState({}, '', '/')
          setIsLoading(false)
          return
        }

        const existingSession = await getValidAccessSession()
        if (cancelled) return
        setSession(existingSession)
      } catch (error) {
        if (cancelled) return
        if (error instanceof OAuthError) {
          setAuthError(error.message)
        } else {
          setAuthError('Failed to initialize authentication')
        }
        if (window.location.pathname === '/oauth/callback') {
          window.history.replaceState({}, '', '/')
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
    if (!session) {
      setUserInfo(null)
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
  }, [session])

  const login = useCallback(async () => {
    setAuthError(null)
    try {
      await startLogin(config ?? undefined)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    }
  }, [config])

  const logout = useCallback(() => {
    oauthLogout()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      config,
      session,
      userInfo,
      isAuthenticated: Boolean(session),
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
