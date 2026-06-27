import { createContext } from 'react'
import type { LogLevel } from './dev-log'

export interface DevConsoleContextValue {
  entries: import('./dev-log').LogEntry[]
  visible: boolean
  minimized: boolean
  height: number
  filters: Set<LogLevel>
  search: string
  show: () => void
  hide: () => void
  toggle: () => void
  minimize: () => void
  expand: () => void
  setHeight: (px: number) => void
  toggleFilter: (level: LogLevel) => void
  soloFilter: (level: LogLevel) => void
  setSearch: (q: string) => void
  clear: () => void
}

export const DevConsoleContext = createContext<DevConsoleContextValue | null>(null)
