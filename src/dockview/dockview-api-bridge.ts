import type { DockviewApi } from 'dockview-react'

/** Live Dockview API from the last onReady — survives StrictMode remounts that
    dispose appNavigator.attach without calling onReady again. */
let liveApi: DockviewApi | null = null

export function setLiveDockviewApi(api: DockviewApi | null): void {
  liveApi = api
}

export function getLiveDockviewApi(): DockviewApi | null {
  return liveApi
}

declare global {
  interface Window {
    __miradorGetDockviewApi?: () => DockviewApi | null
  }
}

if (import.meta.env.DEV) {
  window.__miradorGetDockviewApi = getLiveDockviewApi
}
