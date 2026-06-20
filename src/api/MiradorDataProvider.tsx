import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { MiradorApiError } from './mirador-client'
import { useMiradorApi } from './MiradorApiProvider'
import type { Agent, Queue, Skill, WorkItem } from './types'

const POLL_INTERVAL_MS = 15_000

interface RefreshOptions {
  silent?: boolean
}

interface MiradorDataContextValue {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
  isLoading: boolean
  error: string | null
  refresh: (options?: RefreshOptions) => Promise<void>
}

const MiradorDataContext = createContext<MiradorDataContextValue | null>(null)

export function MiradorDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const client = useMiradorApi()
  const [agents, setAgents] = useState<Agent[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [work, setWork] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [clearData, client])

  useEffect(() => {
    if (!isAuthenticated || !client) {
      clearData()
      setError(null)
      setIsLoading(false)
      return
    }

    void refresh()
  }, [clearData, client, isAuthenticated, refresh])

  useEffect(() => {
    if (!isAuthenticated || !client) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [client, isAuthenticated, refresh])

  const value = useMemo<MiradorDataContextValue>(
    () => ({
      agents,
      queues,
      skills,
      work,
      isLoading,
      error,
      refresh,
    }),
    [agents, error, isLoading, queues, refresh, skills, work],
  )

  return (
    <MiradorDataContext.Provider value={value}>
      {children}
    </MiradorDataContext.Provider>
  )
}

export function useMiradorData(): MiradorDataContextValue {
  const context = useContext(MiradorDataContext)
  if (!context) {
    throw new Error('useMiradorData must be used within MiradorDataProvider')
  }
  return context
}
