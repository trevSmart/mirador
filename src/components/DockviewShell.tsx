import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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

function createDefaultLayout(api: DockviewApi): void {
  api.addPanel({
    id: 'home-initial',
    component: 'home',
    title: getPanelDefinition('home').title,
  })
}

export const DockviewShell = forwardRef<DockviewShellHandle>(function DockviewShell(
  _props,
  ref,
) {
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

  useImperativeHandle(ref, () => ({
    addPanel(type: PanelType) {
      const api = apiRef.current
      if (!api) {
        return
      }
      addPanelByType(api, type)
    },
    getOpenPanelTypes() {
      const api = apiRef.current
      if (!api) {
        return openTypes
      }
      return getOpenPanelTypes(api)
    },
  }), [openTypes])

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
})
