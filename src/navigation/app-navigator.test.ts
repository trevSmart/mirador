import { describe, expect, it } from 'vitest'
import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import { createAppNavigator } from './app-navigator'

/* ── Fake de window.navigation ─────────────────────────────────────────────
   Reprodueix el comportament que el navigator assumeix: navigate() despatxa
   l'event 'navigate' síncronament dins la crida, i un traverse (enrere/
   endavant) arriba amb la URL de destí ja compromesa. */

interface NavigateCall {
  url: string
  options?: NavigationNavigateOptions
}

function createFakeNavigation(initialUrl = 'https://app.test/') {
  const listeners = new Set<(event: NavigateEvent) => void>()
  const navigateCalls: NavigateCall[] = []
  let interceptedCount = 0
  let currentUrl = initialUrl
  let currentState: unknown

  function dispatch(url: string, state: unknown, navigationType: NavigationType) {
    const interceptOptions: NavigationInterceptOptions[] = []
    const event = {
      canIntercept: true,
      hashChange: true,
      downloadRequest: null,
      navigationType,
      destination: { url, getState: () => state },
      intercept: (options?: NavigationInterceptOptions) => {
        interceptedCount += 1
        if (options) interceptOptions.push(options)
      },
    } as unknown as NavigateEvent
    for (const listener of listeners) {
      listener(event)
    }
    currentUrl = url
    currentState = state
    for (const options of interceptOptions) {
      void options.handler?.()
    }
    return interceptOptions.length > 0
  }

  const navigation = {
    get currentEntry() {
      return { url: currentUrl, getState: () => currentState } as unknown as NavigationHistoryEntry
    },
    navigate(url: string, options?: NavigationNavigateOptions) {
      navigateCalls.push({ url, options })
      const absolute = new URL(url, currentUrl).toString()
      dispatch(absolute, options?.state, options?.history === 'replace' ? 'replace' : 'push')
      return { committed: Promise.resolve(), finished: Promise.resolve() }
    },
    addEventListener(type: string, listener: EventListener) {
      if (type === 'navigate') listeners.add(listener)
    },
    removeEventListener(_type: string, listener: EventListener) {
      listeners.delete(listener)
    },
  } as unknown as Navigation

  return {
    navigation,
    navigateCalls,
    dispatchTraverse: (url: string, state?: unknown) =>
      dispatch(new URL(url, initialUrl).toString(), state, 'traverse'),
    getCurrentUrl: () => currentUrl,
    getInterceptedCount: () => interceptedCount,
  }
}

/* ── Fake mínim de DockviewApi ─────────────────────────────────────────────
   Prou fidel perquè el navigator faci servir addPanelByType/openDetailTab
   reals: panels, addPanel, activePanel i onDidActivePanelChange. */

interface FakePanel {
  id: string
  title?: string
  params?: Record<string, unknown>
  view: { contentComponent: string }
  api: {
    title?: string
    setActive: () => void
    updateParameters: (params: Record<string, unknown>) => void
    setTitle: (title: string) => void
  }
}

function createFakeDockviewApi() {
  const panels: FakePanel[] = []
  let activePanel: FakePanel | undefined
  const listeners = new Set<(event: { panel: FakePanel | undefined }) => void>()

  function setActive(panel: FakePanel) {
    activePanel = panel
    for (const listener of listeners) {
      listener({ panel })
    }
  }

  const api = {
    panels,
    get activePanel() {
      return activePanel
    },
    addPanel(options: {
      id: string
      component: string
      title?: string
      params?: Record<string, unknown>
    }) {
      const panel: FakePanel = {
        id: options.id,
        title: options.title,
        params: options.params,
        view: { contentComponent: options.component },
        api: {
          get title() {
            return panel.title
          },
          setActive: () => setActive(panel),
          updateParameters: (params) => {
            panel.params = { ...panel.params, ...params }
          },
          setTitle: (title) => {
            panel.title = title
          },
        },
      }
      panels.push(panel)
      setActive(panel)
      return panel as unknown as IDockviewPanel
    },
    onDidActivePanelChange(listener: (event: { panel: FakePanel | undefined }) => void) {
      listeners.add(listener)
      return { dispose: () => listeners.delete(listener) }
    },
  }

  return {
    api: api as unknown as DockviewApi,
    panels,
    getActivePanel: () => activePanel,
  }
}

function createNavigator(options?: { navigation?: Navigation; hash?: string }) {
  return createAppNavigator({
    getNavigation: () => options?.navigation,
    getLocationHash: () => options?.hash ?? '',
  })
}

describe('createAppNavigator', () => {
  it('does nothing and returns false when opening a panel before attach', () => {
    const navigator = createNavigator()
    expect(navigator.openPanel('agents')).toBe(false)
    expect(navigator.openDetail({ kind: 'agent', id: 'a1' })).toBe(false)
  })

  it('returns true from openPanel/openDetail once attached', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    expect(navigator.openPanel('agents')).toBe(true)
    expect(navigator.openDetail({ kind: 'queue', id: 'q1' }, 'Cua')).toBe(true)
  })

  it('pushes one entry with the panel title when a panel opens', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    navigator.openPanel('agents')

    expect(dock.getActivePanel()?.view.contentComponent).toBe('agents')
    expect(fakeNav.navigateCalls).toEqual([
      { url: '#agents', options: { state: { title: 'Agents' } } },
    ])
  })

  it('does not push again when re-activating the current destination (dedupe)', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    navigator.openPanel('agents')
    navigator.openPanel('agents')

    expect(fakeNav.navigateCalls).toHaveLength(1)
  })

  it('does not intercept its own navigate() calls (guard de self-echo)', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    navigator.openPanel('agents')
    navigator.openPanel('queues')

    expect(fakeNav.getInterceptedCount()).toBe(0)
  })

  it('resolves a deep link on attach without pushing any entry', () => {
    const fakeNav = createFakeNavigation('https://app.test/#queues')
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation, hash: '#queues' })
    navigator.attach(dock.api)

    expect(dock.getActivePanel()?.view.contentComponent).toBe('queues')
    expect(fakeNav.navigateCalls).toHaveLength(0)
  })

  it('replaces (never pushes) the initial URL to match the restored active panel', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    dock.api.addPanel({ id: 'home-initial', component: 'home', title: 'Home' })
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    expect(fakeNav.navigateCalls).toEqual([
      { url: '#home', options: { history: 'replace', state: { title: 'Home' } } },
    ])
  })

  it('intercepts a traverse and activates the panel without re-pushing', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    navigator.openPanel('agents')
    navigator.openPanel('skills')
    const pushesBefore = fakeNav.navigateCalls.length

    const intercepted = fakeNav.dispatchTraverse('/#agents')

    expect(intercepted).toBe(true)
    expect(dock.getActivePanel()?.view.contentComponent).toBe('agents')
    expect(fakeNav.navigateCalls).toHaveLength(pushesBefore)
  })

  it('reopens a closed detail tab on traverse using the title from the entry state', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    fakeNav.dispatchTraverse('/#detail/agent/a1', { title: 'Alice' })

    const active = dock.getActivePanel()
    expect(active?.view.contentComponent).toBe('detail')
    expect(active?.params).toEqual({ kind: 'agent', id: 'a1' })
    expect(active?.title).toBe('Alice')
  })

  it('deep link on attach keeps the restored title of an existing detail tab', () => {
    /* En recarregar, el layout restaurat ja porta el títol real del registre;
       el deep-link no ha de degradar-lo al fallback genèric del tipus. */
    const dock = createFakeDockviewApi()
    dock.api.addPanel({
      id: 'detail-work-w1',
      component: 'detail',
      title: 'Email incidència crítica',
      params: { kind: 'work', id: 'w1' },
    })
    const navigator = createNavigator({ hash: '#detail/work/w1' })
    navigator.attach(dock.api)

    expect(dock.getActivePanel()?.title).toBe('Email incidència crítica')
  })

  it('uses the fallback title when a deep link creates a detail tab from scratch', () => {
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ hash: '#detail/work/w1' })
    navigator.attach(dock.api)

    const active = dock.getActivePanel()
    expect(active?.view.contentComponent).toBe('detail')
    expect(active?.title).toBe('Treball')
  })

  it('ignores foreign hashes it cannot parse', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    const intercepted = fakeNav.dispatchTraverse('/#no-existeix')

    expect(intercepted).toBe(false)
    expect(dock.panels).toHaveLength(0)
  })

  it('degrades gracefully without the Navigation API', () => {
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ hash: '#queues' })
    navigator.attach(dock.api)

    navigator.openPanel('agents')

    const components = dock.panels.map((panel) => panel.view.contentComponent)
    expect(components).toEqual(['queues', 'agents'])
  })

  it('opens detail tabs with the resolved title', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })
    navigator.attach(dock.api)

    navigator.openDetail({ kind: 'queue', id: 'q1' }, 'Cua de suport')

    expect(dock.getActivePanel()?.title).toBe('Cua de suport')
    expect(fakeNav.navigateCalls).toEqual([
      { url: '#detail/queue/q1', options: { state: { title: 'Cua de suport' } } },
    ])
  })

  it('re-attach after dispose keeps a single subscription (StrictMode)', () => {
    const fakeNav = createFakeNavigation()
    const dock = createFakeDockviewApi()
    const navigator = createNavigator({ navigation: fakeNav.navigation })

    const first = navigator.attach(dock.api)
    first.dispose()
    navigator.attach(dock.api)

    navigator.openPanel('agents')
    expect(fakeNav.navigateCalls).toHaveLength(1)

    fakeNav.dispatchTraverse('/#skills')
    expect(fakeNav.getInterceptedCount()).toBe(1)
    expect(dock.getActivePanel()?.view.contentComponent).toBe('skills')
  })
})
