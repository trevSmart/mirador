import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getValidAccessSession } from '../auth/salesforce-oauth'
import { createMiradorClient, type MiradorClient } from './mirador-client'

const MiradorApiContext = createContext<MiradorClient | null>(null)

export function MiradorApiProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  const client = useMemo(() => {
    if (!session) {
      return null
    }

    return createMiradorClient(() => getValidAccessSession())
  }, [session])

  return (
    <MiradorApiContext.Provider value={client}>
      {children}
    </MiradorApiContext.Provider>
  )
}

export function useMiradorApi(): MiradorClient | null {
  return useContext(MiradorApiContext)
}
