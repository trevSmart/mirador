import { useContext } from 'react'
import { DevConsoleContext, type DevConsoleContextValue } from './dev-console-context'

export type { DevConsoleContextValue }

export function useDevConsole(): DevConsoleContextValue {
  const ctx = useContext(DevConsoleContext)
  if (!ctx) throw new Error('useDevConsole must be used inside DevConsoleProvider')
  return ctx
}
