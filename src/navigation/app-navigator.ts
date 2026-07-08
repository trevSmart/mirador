/* App navigator — l'ÚNIC punt d'entrada per obrir o canviar de panell des de
   l'app (header "+", grid de Home, dreceres, drawer de detall). Per sota crida
   la capa baixa de dockview (addPanelByType / openDetailTab); per sobre manté
   sincronitzat window.navigation perquè cada activació de tab sigui una
   entrada d'historial (#agents, #detail/agent/<id>) amb enrere/endavant.

   Sense Navigation API (Firefox, jsdom) tot funciona igual que abans: només
   es perd la integració amb l'historial. El deep-link per location.hash en
   càrrega funciona a tot arreu perquè no necessita l'API. */

import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import type { DetailTarget } from '../detail/detail-drawer-context'
import { FALLBACK_TITLE } from '../detail/resolve-detail-meta'
import { devLog } from '../dev/dev-log'
import { openDetailTab } from '../panels/detail-tab-actions'
import { addPanelByType } from '../panels/panel-actions'
import type { PanelType } from '../panels/registry'
import { destinationFromPanel, parseNavHash, serializeNavHash, type NavDestination } from './nav-hash'
import { getWindowNavigation } from './window-navigation'

export interface AppNavigatorDeps {
  getNavigation: () => Navigation | undefined
  getLocationHash: () => string
}

export interface AppNavigator {
  /** Connecta el navegador a la instància de dockview (des d'onReady).
      Retorna un disposable; cal disposar l'anterior abans de re-attachar. */
  attach(api: DockviewApi): { dispose(): void }
  /** Obre/revela un panell. Retorna false si encara no hi ha dockview
      connectat (l'operació ha estat un no-op i el caller no hauria de donar
      per fet que el panell s'ha obert). */
  openPanel(type: PanelType, params?: Record<string, unknown>): boolean
  openDetail(target: DetailTarget, title?: string): boolean
}

interface NavEntryState {
  title?: string | null
}

export function createAppNavigator(deps: AppNavigatorDeps): AppNavigator {
  let api: DockviewApi | null = null
  /* Guard 1: l'activació ve d'un traverse/deeplink — no tornar a fer push. */
  let applyingHistoryNav = false
  /* Guard 2: el navigate() l'hem disparat nosaltres — no interceptar-lo. */
  let selfNavigation = false

  interface RevealOptions {
    titleHint?: string
    params?: Record<string, unknown>
  }

  /** Retorna true si s'ha pogut revelar (hi ha dockview connectat). */
  function applyReveal(dest: NavDestination, options?: RevealOptions): boolean {
    if (!api) return false
    if (dest.kind === 'panel') {
      addPanelByType(api, dest.panel, options?.params)
    } else {
      openDetailTab(api, dest.target, options?.titleHint ?? FALLBACK_TITLE[dest.target.kind])
    }
    return true
  }

  /* Tot canvi de pestanya programàtic (open de l'app, deep-link, traverse)
     passa per aquí — FUTURA COSTURA VIEW TRANSITIONS: embolcallar applyReveal
     amb document.startViewTransition. Compte: el clic directe sobre un tab el
     gestiona dockview abans que aquest codi; per animar-lo caldrà interceptar
     l'activació a MiradorTab. */
  function reveal(dest: NavDestination, options?: RevealOptions): boolean {
    return applyReveal(dest, options)
  }

  function currentHash(nav: Navigation): string {
    const url = nav.currentEntry?.url
    return url ? new URL(url).hash : deps.getLocationHash()
  }

  function selfNavigate(hash: string, options?: NavigationNavigateOptions): void {
    selfNavigation = true
    try {
      deps.getNavigation()?.navigate(hash, options)
    } catch {
      /* Mai trencar l'activació d'un panell per un error d'historial. */
    } finally {
      selfNavigation = false
    }
  }

  function handlePanelActivated(panel: IDockviewPanel | undefined): void {
    if (!panel) return
    if (applyingHistoryNav) return
    const nav = deps.getNavigation()
    if (!nav) return
    const dest = destinationFromPanel(panel)
    if (!dest) return
    const hash = serializeNavHash(dest)
    if (currentHash(nav) === hash) return
    devLog.action('nav:push', hash)
    const state: NavEntryState = { title: panel.title ?? null }
    selfNavigate(hash, { state })
  }

  function handleNavigate(event: NavigateEvent): void {
    if (selfNavigation) return
    if (!event.canIntercept || event.downloadRequest !== null || !event.hashChange) return
    const hash = new URL(event.destination.url).hash
    const dest = parseNavHash(hash)
    if (!dest) return
    const state = event.destination.getState() as NavEntryState | undefined
    event.intercept({
      focusReset: 'manual',
      scroll: 'manual',
      handler: () => {
        applyingHistoryNav = true
        try {
          devLog.action('nav:traverse', hash)
          reveal(dest, { titleHint: state?.title ?? undefined })
        } finally {
          applyingHistoryNav = false
        }
        return Promise.resolve()
      },
    })
  }

  function attach(nextApi: DockviewApi): { dispose(): void } {
    api = nextApi
    const nav = deps.getNavigation()

    /* Deep-link: si la URL de càrrega ja porta un hash navegable, activa'l
       abans de subscriure'ns perquè no generi cap push. */
    const deepLink = parseNavHash(deps.getLocationHash())
    if (deepLink) {
      applyingHistoryNav = true
      try {
        reveal(deepLink)
      } finally {
        applyingHistoryNav = false
      }
    }

    const activePanelDisposable = nextApi.onDidActivePanelChange(({ panel }) => {
      handlePanelActivated(panel)
    })

    if (nav) {
      /* Reconcilia la URL inicial amb el panell actiu (replace, mai push). */
      const active = nextApi.activePanel
      const dest = active ? destinationFromPanel(active) : null
      if (dest) {
        const hash = serializeNavHash(dest)
        if (currentHash(nav) !== hash) {
          const state: NavEntryState = { title: active?.title ?? null }
          selfNavigate(hash, { history: 'replace', state })
        }
      }
      nav.addEventListener('navigate', handleNavigate as EventListener)
    }

    return {
      dispose() {
        activePanelDisposable.dispose()
        nav?.removeEventListener('navigate', handleNavigate as EventListener)
        if (api === nextApi) {
          api = null
        }
      },
    }
  }

  function openPanel(type: PanelType, params?: Record<string, unknown>): boolean {
    devLog.action('nav:open', type)
    return reveal({ kind: 'panel', panel: type }, { params })
  }

  function openDetail(target: DetailTarget, title?: string): boolean {
    devLog.action('nav:open', `detail ${target.kind} ${target.id}`)
    return reveal({ kind: 'detail', target }, { titleHint: title })
  }

  return { attach, openPanel, openDetail }
}

export const appNavigator = createAppNavigator({
  getNavigation: getWindowNavigation,
  getLocationHash: () => window.location.hash,
})
