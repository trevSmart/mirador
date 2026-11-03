import type { DockviewApi } from 'dockview-react'

/* Referència a l'API de dockview viva, independent del cicle attach/dispose
   del navigator (StrictMode el dispose sense destruir dockview). */

let dockviewApi: DockviewApi | null = null

export function setDockviewApi(api: DockviewApi | null): void {
  dockviewApi = api
}

export function getDockviewApi(): DockviewApi | null {
  return dockviewApi
}
