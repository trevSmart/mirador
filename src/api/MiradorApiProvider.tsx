import { useMemo, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { getValidAccessSession } from '../auth/salesforce-oauth'
import { createMiradorClient } from './mirador-client'
import { createMockMiradorClient } from './mock/mock-client'
import { MiradorApiContext } from './mirador-api-context'

export function MiradorApiProvider({ children }: { children: ReactNode }) {
  const { isMockMode, session } = useAuth()

  const client = useMemo(() => {
    if (isMockMode) {
      return createMockMiradorClient()
    }

    if (!session) {
      return null
    }

    return createMiradorClient(() => getValidAccessSession())
  }, [isMockMode, session])

  return (
    <MiradorApiContext.Provider value={client}>
      {children}
    </MiradorApiContext.Provider>
  )
}
