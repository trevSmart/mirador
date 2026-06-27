import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/auth-context'
import { makeQueryClient } from './query-client'
import { devLog } from '../../dev/dev-log'

/**
 * Mounts the global QueryClient for the Data Service layer. Created once via
 * lazy state so the cache survives re-renders. Placed below MiradorApiProvider
 * (it needs the client) and above the data/UI consumers.
 *
 * It also bridges the cache into the dev console: every resolved response or
 * error is forwarded to `devLog` under the `query` level, so TanStack activity
 * is visible alongside actions and API calls.
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

  useEffect(() => {
    const cache = queryClient.getQueryCache()
    return cache.subscribe((event) => {
      if (event.type !== 'updated') return
      const key = JSON.stringify(event.query.queryKey)
      if (event.action.type === 'success') {
        devLog.query('success', key, event.action.data)
      } else if (event.action.type === 'error') {
        devLog.query('error', key, event.action.error)
      }
    })
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
