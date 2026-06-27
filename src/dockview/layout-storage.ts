import type { DockviewApi } from 'dockview-react'

const STORAGE_KEY = 'mirador-dockview-layout-v1'

export function loadDockviewLayout(api: DockviewApi): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return false
  }

  try {
    api.fromJSON(JSON.parse(raw) as Parameters<DockviewApi['fromJSON']>[0])
    return true
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return false
  }
}

export function saveDockviewLayout(api: DockviewApi): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(api.toJSON()))
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}
