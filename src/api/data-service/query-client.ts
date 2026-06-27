import { QueryClient } from '@tanstack/react-query'

/**
 * Builds the global QueryClient for the Data Service layer.
 *
 * Defaults are tuned for Mirador:
 * - `staleTime` keeps recently fetched entities fresh so reopening the same
 *   detail twice does not refetch.
 * - `retry: 1` mirrors the single session-recovery retry in mirador-client.ts.
 * - `refetchOnWindowFocus` is off because the app already polls via
 *   MiradorDataProvider; we don't want a second, uncoordinated refetch trigger.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
