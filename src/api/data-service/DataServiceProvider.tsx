import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/auth-context'
import { makeQueryClient } from './query-client'

/**
 * Mounts the global QueryClient for the Data Service layer. Created once via
 * lazy state so the cache survives re-renders. Placed below MiradorApiProvider
 * (it needs the client) and above the data/UI consumers.
 */
export function DataServiceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isMockMode } = useAuth()
  const [queryClient] = useState(() => makeQueryClient())
  const prevMockModeRef = useRef(isMockMode)

  useEffect(() => {
    // Prevent stale data from being shown when auth is lost or the data source
    // changes (mock ↔ Salesforce).
    if (!isMockMode && !isAuthenticated) {
      queryClient.clear()
    }

    if (prevMockModeRef.current !== isMockMode) {
      prevMockModeRef.current = isMockMode
      queryClient.clear()
    }
  }, [isAuthenticated, isMockMode, queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
