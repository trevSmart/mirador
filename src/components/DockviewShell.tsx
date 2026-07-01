import {
  useEffect,
  useRef,
  useState,
  type Ref,
} from 'react'
import { DockviewReact } from 'dockview-react'
import type { DockviewApi, DockviewReadyEvent } from 'dockview-react'
import { AddPanelHeaderActions } from './AddPanelHeaderActions'
import { MiradorTab } from './MiradorTab'
import {
  getMiradorTabContextMenuItems,
  getMiradorTabGroupChipContextMenuItems,
} from '../dockview/context-menus'
import { loadDockviewLayout, saveDockviewLayout } from '../dockview/layout-storage'
import { useDockviewHost } from '../dockview/dockview-host-context'
import { devLog } from '../dev/dev-log'
import { miradorDockviewTheme } from '../dockview/theme'
import { DetailPanel } from '../panels/DetailPanel'
import { PANEL_COMPONENTS, getPanelDefinition, type PanelType } from '../panels/registry'
import {
  addPanelByType,
  ensureHomePanel,
  getOpenPanelTypes,
} from '../panels/panel-actions'

interface DockviewShellHandle {
  addPanel: (type: PanelType) => void
  getOpenPanelTypes: () => PanelType[]
}

interface DockviewShellProps {
  ref?: Ref<DockviewShellHandle>
}

function closeLegacyInsightsPanels(api: DockviewApi): void {
  for (const panel of [...api.panels]) {
    if (panel.view.contentComponent === 'insights') {
      panel.api.close()
    }
  }
}

function createDefaultLayout(api: DockviewApi): void {
  api.addPanel({
    id: 'home-initial',
    component: 'home',
    title: getPanelDefinition('home').title,
  })
}

export function DockviewShell({ ref }: DockviewShellProps) {
  const apiRef = useRef<DockviewApi | null>(null)
  const layoutDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const panelDisposablesRef = useRef<{ dispose: () => void }[]>([])
  const [openTypes, setOpenTypes] = useState<PanelType[]>(['home'])
  const { registerApi } = useDockviewHost()

  const syncOpenTypes = (api: DockviewApi) => {
    setOpenTypes(getOpenPanelTypes(api))
  }

  useEffect(() => {
    return () => {
      layoutDisposableRef.current?.dispose()
      panelDisposablesRef.current.forEach((d) => d.dispose())
      panelDisposablesRef.current = []
    }
  }, [])

  // Expose imperative handle via ref prop (React 19 pattern).
  useEffect(() => {
    if (!ref) return
    const handle: DockviewShellHandle = {
      addPanel(type: PanelType) {
        const api = apiRef.current
        if (!api) return
        addPanelByType(api, type)
      },
      getOpenPanelTypes() {
        const api = apiRef.current
        if (!api) return openTypes
        return getOpenPanelTypes(api)
      },
    }
    if (typeof ref === 'function') {
      ref(handle)
      return () => {
        ref(null)
      }
    }
    ref.current = handle
    return () => {
      ref.current = null
    }
  }, [ref, openTypes])

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api
    registerApi(event.api)

    const loaded = loadDockviewLayout(event.api)
    if (!loaded || event.api.panels.length === 0) {
      createDefaultLayout(event.api)
    }
    closeLegacyInsightsPanels(event.api)
    ensureHomePanel(event.api)

    // Dispose any prior subscriptions so a re-run of onReady (StrictMode
    // double-invoke, remount) doesn't accumulate duplicate handlers.
    panelDisposablesRef.current.forEach((d) => d.dispose())
    panelDisposablesRef.current = [
      event.api.onDidAddPanel((panel) => {
        devLog.action('panel:open', panel.title ?? panel.id)
        syncOpenTypes(event.api)
      }),
      event.api.onDidRemovePanel((panel) => {
        devLog.action('panel:close', panel.title ?? panel.id)
        ensureHomePanel(event.api)
        syncOpenTypes(event.api)
      }),
      event.api.onDidActivePanelChange(({ panel }) => {
        if (panel) devLog.action('panel:activate', panel.title ?? panel.id)
      }),
    ]
    syncOpenTypes(event.api)

    layoutDisposableRef.current?.dispose()
    layoutDisposableRef.current = event.api.onDidLayoutChange(() => {
      saveDockviewLayout(event.api)
    })
  }

  return (
    <DockviewReact
      theme={miradorDockviewTheme}
      onReady={onReady}
      components={{ ...PANEL_COMPONENTS, detail: DetailPanel }}
      defaultTabComponent={MiradorTab}
      leftHeaderActionsComponent={AddPanelHeaderActions}
      getTabContextMenuItems={getMiradorTabContextMenuItems}
      getTabGroupChipContextMenuItems={getMiradorTabGroupChipContextMenuItems}
    />
  )
}
