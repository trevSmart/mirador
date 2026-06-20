import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { MiradorApiError } from './mirador-client'
import { useMiradorApi } from './MiradorApiProvider'
import type { Agent, Queue } from './types'

interface MiradorDataContextValue {
  agents: Agent[]
  queues: Queue[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const MiradorDataContext = createContext<MiradorDataContextValue | null>(null)

export function MiradorDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const client = useMiradorApi()
  const [agents, setAgents] = useState<Agent[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!client) {
      setAgents([])
      setQueues([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [agentsResponse, queuesResponse] = await Promise.all([
        client.getAgents('all'),
        client.getQueues(),
      ])
      setAgents(agentsResponse.agents)
      setQueues(queuesResponse.queues)
    } catch (fetchError) {
      setAgents([])
      setQueues([])
      setError(
        fetchError instanceof MiradorApiError
          ? fetchError.message
          : 'No s\'han pogut carregar les dades de Salesforce',
      )
    } finally {
      setIsLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (!isAuthenticated || !client) {
      setAgents([])
      setQueues([])
      setError(null)
      setIsLoading(false)
      return
    }

    void refresh()
  }, [client, isAuthenticated, refresh])

  const value = useMemo<MiradorDataContextValue>(
    () => ({
      agents,
      queues,
      isLoading,
      error,
      refresh,
    }),
    [agents, error, isLoading, queues, refresh],
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
