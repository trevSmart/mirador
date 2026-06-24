import { createContext, useContext } from 'react'
import type { DockviewApi } from 'dockview-react'

export interface DockviewHostContextValue {
  registerApi: (api: DockviewApi) => void
  getApi: () => DockviewApi | null
}

export const DockviewHostContext = createContext<DockviewHostContextValue | null>(null)

export function useDockviewHost(): DockviewHostContextValue {
  const ctx = useContext(DockviewHostContext)
  if (!ctx) {
    throw new Error('useDockviewHost must be used within DockviewHostProvider')
  }
  return ctx
}
