import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../settings/preferences-context'
import { devLog } from '../dev/dev-log'
import { primeSnapshot } from './data-service'
import { MiradorApiError } from './mirador-client'
import { useMiradorApi } from './mirador-api-context'
import { MiradorDataContext } from './mirador-data-context'
import {
  MiradorStatusContext,
  type RefreshOptions,
} from './mirador-status-context'
import type { Agent, Queue, Skill, WorkItem } from './types'

/** Minimum time between refresh executions (rate limit). */
const MIN_REFRESH_GAP_MS = 1_500

export function MiradorDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const client = useMiradorApi()
  const queryClient = useQueryClient()
  const { prefs } = usePreferences()
  const isActive = isAuthenticated && Boolean(client)
  const [agents, setAgents] = useState<Agent[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [work, setWork] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRefreshingRef = useRef(false)
  const lastRefreshStartedAtRef = useRef(0)
  const pendingRefreshOptionsRef = useRef<RefreshOptions | null>(null)
  const pendingRefreshTimerRef = useRef(0)

  const clearData = useCallback(() => {
    setAgents([])
    setQueues([])
    setSkills([])
    setWork([])
  }, [])

  const runRefresh = useCallback(async (options?: RefreshOptions) => {
    const silent = options?.silent ?? false

    if (!client) {
      clearData()
      setError(null)
      setIsLoading(false)
      return
    }

    if (isRefreshingRef.current) {
      return
    }

    isRefreshingRef.current = true
    setIsRefreshing(true)

    if (!silent) {
      setIsLoading(true)
      setError(null)
    }

    devLog.action(silent ? 'data:refresh (silent)' : 'data:refresh')

    try {
      const snapshot = await client.getSnapshot('all')
      setAgents(snapshot.agents)
      setQueues(snapshot.queues)
      setSkills(snapshot.skills)
      setWork(snapshot.work)
      // Seed the Data Service cache so per-entity reads (useEntity) resolve from
      // cache without an extra fetch. The context above stays the source for
      // existing consumers; this hydrates the new layer in parallel.
      primeSnapshot(queryClient, snapshot)
      if (silent) {
        setError(null)
      }
      devLog.action('data:loaded', {
        agents: snapshot.agents.length,
        queues: snapshot.queues.length,
        skills: snapshot.skills.length,
        work: snapshot.work.length,
      })
    } catch (fetchError) {
      const message =
        fetchError instanceof MiradorApiError
          ? fetchError.message
          : 'No s\'han pogut carregar les dades de Salesforce'
      console.error('[data:refresh] failed:', message)
      if (!silent) {
        clearData()
        setError(message)
      }
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [clearData, client, queryClient])

  const dispatchRefreshRef = useRef<(options?: RefreshOptions) => void>(() => {})

  // Keep the dispatcher current with each render's captured values. refresh()
  // is only ever called from effects/handlers, never during render, so the ref
  // is always up to date by the time it runs.
  useEffect(() => {
    dispatchRefreshRef.current = (options?: RefreshOptions) => {
      if (!client) {
        clearData()
        setError(null)
        setIsLoading(false)
        pendingRefreshOptionsRef.current = null
        window.clearTimeout(pendingRefreshTimerRef.current)
        pendingRefreshTimerRef.current = 0
        return
      }

      // Coalesce rapid calls; keep the latest options.
      pendingRefreshOptionsRef.current = options ?? {}

      const flushPending = () => {
        if (pendingRefreshOptionsRef.current === null) return

        const now = Date.now()
        const elapsed = now - lastRefreshStartedAtRef.current
        if (lastRefreshStartedAtRef.current > 0 && elapsed < MIN_REFRESH_GAP_MS) {
          if (pendingRefreshTimerRef.current === 0) {
            pendingRefreshTimerRef.current = window.setTimeout(() => {
              pendingRefreshTimerRef.current = 0
              flushPending()
            }, MIN_REFRESH_GAP_MS - elapsed)
          }
          return
        }

        if (isRefreshingRef.current) return

        const pending = pendingRefreshOptionsRef.current
        pendingRefreshOptionsRef.current = null
        lastRefreshStartedAtRef.current = now

        void runRefresh(pending).finally(() => {
          if (pendingRefreshOptionsRef.current !== null) {
            flushPending()
          }
        })
      }

      flushPending()
    }
  }, [client, clearData, runRefresh])

  const refresh = useCallback(async (options?: RefreshOptions) => {
    dispatchRefreshRef.current(options)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(pendingRefreshTimerRef.current)
    }
  }, [])

  const authedNow = isActive && Boolean(client)
  // Reset to a clean idle state when auth/client is lost. The setState part is
  // done during render (convergent) to avoid a synchronous effect setState; the
  // pending-timer cleanup (ref work) belongs in an effect.
  const [prevAuthed, setPrevAuthed] = useState(authedNow)
  if (prevAuthed !== authedNow) {
    setPrevAuthed(authedNow)
    if (!authedNow) {
      clearData()
      setError(null)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (authedNow) return
    pendingRefreshOptionsRef.current = null
    window.clearTimeout(pendingRefreshTimerRef.current)
    pendingRefreshTimerRef.current = 0
  }, [authedNow])

  useEffect(() => {
    if (!isActive || !client) {
      return
    }

    // Defer so the setState inside refresh() doesn't run synchronously in the effect.
    queueMicrotask(() => {
      void refresh()
    })
  }, [client, isActive, refresh])

  useEffect(() => {
    if (!isActive || !client || !prefs.autoRefresh) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true })
    }, prefs.refreshInterval * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [client, isActive, refresh, prefs.autoRefresh, prefs.refreshInterval])

  // Separate memos: data changes don't trigger status consumers, and vice versa.
  const dataValue = useMemo(
    () => ({ agents, queues, skills, work }),
    [agents, queues, skills, work],
  )

  const statusValue = useMemo(
    () => ({ isLoading, isRefreshing, error, refresh }),
    [error, isLoading, isRefreshing, refresh],
  )

  return (
    <MiradorDataContext.Provider value={dataValue}>
      <MiradorStatusContext.Provider value={statusValue}>
        {children}
      </MiradorStatusContext.Provider>
    </MiradorDataContext.Provider>
  )
}
