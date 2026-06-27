import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { makeQueryClient } from './query-client'

/**
 * Mounts the global QueryClient for the Data Service layer. Created once via
 * lazy state so the cache survives re-renders. Placed below MiradorApiProvider
 * (it needs the client) and above the data/UI consumers.
 */
export function DataServiceProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
