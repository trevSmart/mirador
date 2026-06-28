/* Mirador data hooks — the UI's single entry point to live snapshot data.
   These read straight from the Data Service cache (TanStack Query): one shared
   snapshot query feeds typed selectors, so every consumer reuses the same fetch.
   Polling, dedup and freshness live in TanStack, not in a bespoke provider. */

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../settings/preferences-context'
import { useSourceClient } from './data-service'
import { fetchSnapshot, snapshotKey } from './data-service'
import { MiradorApiError } from './mirador-client'
import type {
  Agent,
  AgentScope,
  PresenceStatusOption,
  Queue,
  Skill,
  SnapshotResponse,
  WorkItem,
} from './types'

// Stable empty arrays so consumers' memo deps don't churn while data loads.
const EMPTY_AGENTS: Agent[] = []
const EMPTY_QUEUES: Queue[] = []
const EMPTY_SKILLS: Skill[] = []
const EMPTY_WORK: WorkItem[] = []
const EMPTY_PRESENCE_STATUSES: PresenceStatusOption[] = []

const selectAgents = (snapshot: SnapshotResponse) => snapshot.agents
const selectQueues = (snapshot: SnapshotResponse) => snapshot.queues
const selectSkills = (snapshot: SnapshotResponse) => snapshot.skills
const selectWork = (snapshot: SnapshotResponse) => snapshot.work
const selectPresenceStatuses = (snapshot: SnapshotResponse) =>
  snapshot.presenceStatuses

/**
 * Canonical options for the shared snapshot query. Every hook below spreads
 * these so they all observe the same query (one fetch, one poll). The query is
 * disabled (skipToken) until authenticated with a client; polling follows the
 * user's auto-refresh preference.
 */
function useSnapshotConfig() {
  const { isAuthenticated } = useAuth()
  const client = useSourceClient('salesforce')
  const queryClient = useQueryClient()
  const { prefs } = usePreferences()
  const enabled = isAuthenticated && client !== null
  // Show offline reps → request the full roster; otherwise only connected
  // agents. The scope is part of the query key so the two are cached apart.
  const scope: AgentScope = prefs.showOfflineAgents ? 'all' : 'connected'

  return {
    queryKey: snapshotKey(scope),
    queryFn:
      enabled && client
        ? () => fetchSnapshot(client, queryClient, scope)
        : skipToken,
    // Short window so panels mounting together coalesce into one fetch, while
    // refetchInterval drives liveness.
    staleTime: 1_500,
    refetchInterval: prefs.autoRefresh ? prefs.refreshInterval * 1000 : false,
    refetchIntervalInBackground: true,
    // Newly-mounted readers (e.g. opening the detail drawer) reuse the cache
    // instead of triggering a snapshot refetch — freshness is the polling
    // interval's job. The first load (no data) and the manual refresh
    // (invalidateQueries) still fetch regardless.
    refetchOnMount: false,
  } as const
}

export function useAgents(): Agent[] {
  const config = useSnapshotConfig()
  return useQuery({ ...config, select: selectAgents }).data ?? EMPTY_AGENTS
}

export function useQueues(): Queue[] {
  const config = useSnapshotConfig()
  return useQuery({ ...config, select: selectQueues }).data ?? EMPTY_QUEUES
}

export function useSkills(): Skill[] {
  const config = useSnapshotConfig()
  return useQuery({ ...config, select: selectSkills }).data ?? EMPTY_SKILLS
}

export function useWork(): WorkItem[] {
  const config = useSnapshotConfig()
  return useQuery({ ...config, select: selectWork }).data ?? EMPTY_WORK
}

export function usePresenceStatuses(): PresenceStatusOption[] {
  const config = useSnapshotConfig()
  return (
    useQuery({ ...config, select: selectPresenceStatuses }).data ??
    EMPTY_PRESENCE_STATUSES
  )
}

const GENERIC_ERROR = 'No s\'han pogut carregar les dades de Salesforce'

/** Best-effort human-readable message for a snapshot fetch failure. */
function errorMessage(err: unknown): string {
  if (err instanceof MiradorApiError) {
    return err.status
      ? `${err.message} (HTTP ${err.status})`
      : err.message || GENERIC_ERROR
  }
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return GENERIC_ERROR
}

export interface DataStatus {
  /** First load with no data yet. */
  isLoading: boolean
  /** Any fetch in flight (initial or background poll/refresh). */
  isRefreshing: boolean
  error: string | null
  /** Forces an immediate background refetch of the snapshot. */
  refresh: () => Promise<void>
}

/**
 * Fetch status for the snapshot feed plus a manual refresh. Subscribing here
 * (e.g. from the always-mounted header) keeps the snapshot query alive, so
 * polling runs app-wide.
 */
export function useDataStatus(): DataStatus {
  const config = useSnapshotConfig()
  const queryClient = useQueryClient()
  const query = useQuery({
    ...config,
    notifyOnChangeProps: ['isLoading', 'isFetching', 'error'],
  })

  const queryKey = config.queryKey
  const refresh = useCallback(() => {
    const state = queryClient.getQueryState(queryKey)
    if (state?.fetchStatus === 'fetching') return Promise.resolve()
    return queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  // Surface the real failure reason: MiradorApiError carries the server message,
  // and plain Errors (network, CORS, expired token, etc.) carry theirs. Only
  // fall back to the generic string when there's genuinely no message to show.
  const error =
    query.error && query.data === undefined
      ? errorMessage(query.error)
      : null

  return {
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error,
    refresh,
  }
}
