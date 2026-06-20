import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { DockviewReact, themeLightSpaced } from 'dockview'
import type { DockviewApi, DockviewReadyEvent } from 'dockview'
import { PANEL_COMPONENTS, getPanelDefinition, type PanelType } from '../panels/registry'

export interface DockviewShellHandle {
  addPanel: (type: PanelType) => void
  getOpenPanelTypes: () => PanelType[]
}

let panelCounter = 0

function getPanelTypeFromComponent(component: string | undefined): PanelType | null {
  if (!component) {
    return null
  }
  if (component in PANEL_COMPONENTS) {
    return component as PanelType
  }
  return null
}

export const DockviewShell = forwardRef<DockviewShellHandle>(function DockviewShell(
  _props,
  ref,
) {
  const apiRef = useRef<DockviewApi | null>(null)
  const [openTypes, setOpenTypes] = useState<PanelType[]>(['home'])

  const syncOpenTypes = (api: DockviewApi) => {
    const types = api.panels
      .map((panel) => getPanelTypeFromComponent(panel.view.contentComponent))
      .filter((type): type is PanelType => type !== null)
    setOpenTypes(types)
  }

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api
    event.api.addPanel({
      id: 'home-initial',
      component: 'home',
      title: getPanelDefinition('home').title,
    })

    event.api.onDidAddPanel(() => syncOpenTypes(event.api))
    event.api.onDidRemovePanel(() => syncOpenTypes(event.api))
    syncOpenTypes(event.api)
  }

  useImperativeHandle(ref, () => ({
    addPanel(type: PanelType) {
      const api = apiRef.current
      if (!api) {
        return
      }

      const open = api.panels
        .map((panel) => getPanelTypeFromComponent(panel.view.contentComponent))
        .filter((item): item is PanelType => item !== null)

      if (open.includes(type)) {
        return
      }

      const definition = getPanelDefinition(type)
      panelCounter += 1
      api.addPanel({
        id: `${type}-${panelCounter}`,
        component: type,
        title: definition.title,
      })
    },
    getOpenPanelTypes() {
      const api = apiRef.current
      if (!api) {
        return openTypes
      }

      return api.panels
        .map((panel) => getPanelTypeFromComponent(panel.view.contentComponent))
        .filter((item): item is PanelType => item !== null)
    },
  }), [openTypes])

  return (
    <DockviewReact
      theme={themeLightSpaced}
      onReady={onReady}
      components={PANEL_COMPONENTS}
    />
  )
})
