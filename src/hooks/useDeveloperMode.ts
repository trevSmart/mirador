/* Developer mode — a small app-wide boolean flag, persisted in localStorage and
   synced across components (and tabs). Nothing hangs off it yet; it's the hook
   future debug/instrumentation features can switch on. */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'mirador.developerMode'
const EVENT = 'mirador:devmode'

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export interface DeveloperModeState {
  enabled: boolean
  set: (value: boolean) => void
  toggle: () => void
}

export function useDeveloperMode(): DeveloperModeState {
  const [enabled, setEnabled] = useState(read)

  useEffect(() => {
    const sync = () => setEnabled(read())
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync()
    }
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const set = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    } catch {
      /* ignore quota / private mode */
    }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const toggle = useCallback(() => set(!read()), [set])

  return { enabled, set, toggle }
}
