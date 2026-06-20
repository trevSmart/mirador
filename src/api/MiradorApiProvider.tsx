import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isMockMode } from '../config/data-source'
import { getValidAccessSession } from '../auth/salesforce-oauth'
import { createMiradorClient, type MiradorClient } from './mirador-client'
import { createMockMiradorClient } from './mock/mock-client'

const MiradorApiContext = createContext<MiradorClient | null>(null)

export function MiradorApiProvider({ children }: { children: ReactNode }) {
  const { config, session } = useAuth()

  const client = useMemo(() => {
    if (isMockMode(config)) {
      return createMockMiradorClient()
    }

    if (!session) {
      return null
    }

    return createMiradorClient(() => getValidAccessSession())
  }, [config, session])

  return (
    <MiradorApiContext.Provider value={client}>
      {children}
    </MiradorApiContext.Provider>
  )
}

export function useMiradorApi(): MiradorClient | null {
  return useContext(MiradorApiContext)
}
