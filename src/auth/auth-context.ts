/* Auth — context + hook (no components, so Fast Refresh stays happy).
   The <AuthProvider> in AuthProvider.tsx supplies this context's value. */

import { createContext, useContext } from 'react'
import type { OAuthSession, PublicOAuthConfig, SalesforceUserInfo } from './types'

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
