import { useMemo, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../settings/preferences-context'
import { isMockMode } from '../config/data-source'
import { getValidAccessSession } from '../auth/salesforce-oauth'
import { createMiradorClient } from './mirador-client'
import { createMockMiradorClient } from './mock/mock-client'
import { MiradorApiContext } from './mirador-api-context'

export function MiradorApiProvider({ children }: { children: ReactNode }) {
  const { config, session } = useAuth()
  const { prefs } = usePreferences()

  const client = useMemo(() => {
    if (isMockMode(config) || prefs.mockOverride) {
      return createMockMiradorClient()
    }

    if (!session) {
      return null
    }

    return createMiradorClient(() => getValidAccessSession())
  }, [config, session, prefs.mockOverride])

  return (
    <MiradorApiContext.Provider value={client}>
      {children}
    </MiradorApiContext.Provider>
  )
}
