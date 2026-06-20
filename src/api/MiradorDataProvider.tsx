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
import type { Agent, Queue, Skill, WorkItem } from './types'

interface MiradorDataContextValue {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
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
  const [skills, setSkills] = useState<Skill[]>([])
  const [work, setWork] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearData = useCallback(() => {
    setAgents([])
    setQueues([])
    setSkills([])
    setWork([])
  }, [])

  const refresh = useCallback(async () => {
    if (!client) {
      clearData()
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

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
    } catch (fetchError) {
      clearData()
      setError(
        fetchError instanceof MiradorApiError
          ? fetchError.message
          : 'No s\'han pogut carregar les dades de Salesforce',
      )
    } finally {
      setIsLoading(false)
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
