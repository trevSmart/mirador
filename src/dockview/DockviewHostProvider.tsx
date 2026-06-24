import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DockviewApi } from 'dockview-react'
import { DockviewHostContext, type DockviewHostContextValue } from './dockview-host-context'

export function DockviewHostProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<DockviewApi | null>(null)
  const [, setRevision] = useState(0)

  const registerApi = useCallback((api: DockviewApi) => {
    apiRef.current = api
    setRevision((value) => value + 1)
  }, [])

  const getApi = useCallback(() => apiRef.current, [])

  const value = useMemo<DockviewHostContextValue>(
    () => ({ registerApi, getApi }),
    [registerApi, getApi],
  )

  return <DockviewHostContext.Provider value={value}>{children}</DockviewHostContext.Provider>
}
