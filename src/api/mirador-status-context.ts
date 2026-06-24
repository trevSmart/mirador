/* Mirador fetch status — context + hooks (no components, for Fast Refresh).
   The <MiradorDataProvider> in MiradorDataProvider.tsx supplies this value.
   Separated from mirador-data-context so components that only read data
   do not re-render when loading/refreshing state changes. */

import { createContext, useContext } from 'react'

export interface RefreshOptions {
  silent?: boolean
}

export interface MiradorStatusContextValue {
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: (options?: RefreshOptions) => Promise<void>
}

export const MiradorStatusContext = createContext<MiradorStatusContextValue | null>(null)

export function useMiradorStatus(): MiradorStatusContextValue {
  const context = useContext(MiradorStatusContext)
  if (!context) {
    throw new Error('useMiradorStatus must be used within MiradorDataProvider')
  }
  return context
}
