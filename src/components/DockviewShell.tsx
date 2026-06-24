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
import { miradorDockviewTheme } from '../dockview/theme'
import { PANEL_COMPONENTS, getPanelDefinition, type PanelType } from '../panels/registry'
import {
  addPanelByType,
  getOpenPanelTypes,
} from '../panels/panel-actions'

export interface DockviewShellHandle {
  addPanel: (type: PanelType) => void
  getOpenPanelTypes: () => PanelType[]
}

interface DockviewShellProps {
  ref?: Ref<DockviewShellHandle>
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
  const [openTypes, setOpenTypes] = useState<PanelType[]>(['home'])

  const syncOpenTypes = (api: DockviewApi) => {
    setOpenTypes(getOpenPanelTypes(api))
  }

  useEffect(() => {
    return () => {
      layoutDisposableRef.current?.dispose()
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
      return () => ref(null)
    }
    ref.current = handle
    return () => {
      ref.current = null
    }
  }, [ref, openTypes])

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api

    const loaded = loadDockviewLayout(event.api)
    if (!loaded || event.api.panels.length === 0) {
      createDefaultLayout(event.api)
    }

    event.api.onDidAddPanel(() => syncOpenTypes(event.api))
    event.api.onDidRemovePanel(() => syncOpenTypes(event.api))
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
      components={PANEL_COMPONENTS}
      defaultTabComponent={MiradorTab}
      leftHeaderActionsComponent={AddPanelHeaderActions}
      getTabContextMenuItems={getMiradorTabContextMenuItems}
      getTabGroupChipContextMenuItems={getMiradorTabGroupChipContextMenuItems}
    />
  )
}
