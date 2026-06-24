import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../settings/preferences-context'
import { MiradorApiError } from './mirador-client'
import { useMiradorApi } from './mirador-api-context'
import { MiradorDataContext } from './mirador-data-context'
import {
  MiradorStatusContext,
  type RefreshOptions,
} from './mirador-status-context'
import type { Agent, Queue, Skill, WorkItem } from './types'

export function MiradorDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const client = useMiradorApi()
  const { prefs } = usePreferences()
  const [agents, setAgents] = useState<Agent[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [work, setWork] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRefreshingRef = useRef(false)

  const clearData = useCallback(() => {
    setAgents([])
    setQueues([])
    setSkills([])
    setWork([])
  }, [])

  const refresh = useCallback(async (options?: RefreshOptions) => {
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

    try {
      const [agentsResponse, queuesResponse, skillsResponse, workResponse] =
        await Promise.all([
          client.getAgents('all'),
          client.getQueues(),
          client.getSkills(),
          client.getWork(),
        ])
      setAgents(agentsResponse.agents)
      setQueues(queuesResponse.queues)
      setSkills(skillsResponse.skills)
      setWork(workResponse.work)
      if (silent) {
        setError(null)
      }
    } catch (fetchError) {
      if (!silent) {
        clearData()
        setError(
          fetchError instanceof MiradorApiError
            ? fetchError.message
            : 'No s\'han pogut carregar les dades de Salesforce',
        )
      }
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [clearData, client])

  const authedNow = isAuthenticated && Boolean(client)
  // Reset to a clean idle state when auth/client is lost. Done during render
  // (convergent) instead of in an effect, to avoid a synchronous effect setState.
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
    if (!isAuthenticated || !client) {
      return
    }

    // Defer so the setState inside refresh() doesn't run synchronously in the effect.
    queueMicrotask(() => {
      void refresh()
    })
  }, [client, isAuthenticated, refresh])

  useEffect(() => {
    if (!isAuthenticated || !client || !prefs.autoRefresh) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true })
    }, prefs.refreshInterval * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [client, isAuthenticated, refresh, prefs.autoRefresh, prefs.refreshInterval])

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
