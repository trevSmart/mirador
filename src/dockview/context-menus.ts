import type {
  BuiltInChipContextMenuItem,
  BuiltInContextMenuItem,
  GetTabContextMenuItemsParams,
  GetTabGroupChipContextMenuItemsParams,
  ReactContextMenuItemConfig,
} from 'dockview-react'
import {
  addPanelToExistingTabGroup,
  createTabGroupWithPanel,
  dissolveTabGroup,
  removePanelFromTabGroup,
} from './tab-groups'
import { getPanelTypeFromComponent, isPanelClosable } from '../panels/panel-actions'
import type { DockviewGroupPanel, IDockviewPanel } from 'dockview-react'

function isClosablePanel(panel: IDockviewPanel): boolean {
  const type = getPanelTypeFromComponent(panel.view.contentComponent)
  return type ? isPanelClosable(type) : true
}

function closeClosablePanels(panels: readonly IDockviewPanel[]): void {
  panels.filter(isClosablePanel).forEach((entry) => entry.api.close())
}

function mergeAllPanelsIntoGroup(
  groups: readonly DockviewGroupPanel[],
  target: DockviewGroupPanel,
  activePanel: IDockviewPanel,
): void {
  for (const other of groups.filter((entry) => entry !== target)) {
    for (const entry of [...other.panels]) {
      entry.api.moveTo({ group: target })
    }
  }
  activePanel.api.setActive()
}

type MiradorTabContextMenuItem = BuiltInContextMenuItem | ReactContextMenuItemConfig
type TabGroupChipContextMenuItem = BuiltInChipContextMenuItem | ReactContextMenuItemConfig

export function getMiradorTabContextMenuItems(
  params: GetTabContextMenuItemsParams,
): MiradorTabContextMenuItem[] {
  const { panel, group, api } = params
  const groupId = group.id
  const currentTabGroup = api.getTabGroupForPanel({
    groupId,
    panelId: panel.id,
  })
  const tabGroups = api.getTabGroups({ groupId })

  const closable = isClosablePanel(panel)
  const hasOtherClosablePanels = group.panels.some(
    (entry) => entry !== panel && isClosablePanel(entry),
  )
  const hasClosablePanels = group.panels.some(isClosablePanel)

  const items: MiradorTabContextMenuItem[] = []

  if (closable) {
    items.push({
      label: 'Tancar',
      action: () => panel.api.close(),
    })
  }

  if (hasOtherClosablePanels) {
    items.push({
      label: 'Tancar les altres',
      action: () => {
        closeClosablePanels(group.panels.filter((entry) => entry !== panel))
      },
    })
  }

  if (hasClosablePanels) {
    items.push({
      label: 'Tancar totes',
      action: () => {
        closeClosablePanels(group.panels)
      },
    })
  }

  if (api.groups.length > 1) {
    if (items.length > 0) {
      items.push('separator')
    }
    items.push({
      label: 'Unir tots els panells',
      action: () => {
        mergeAllPanelsIntoGroup(api.groups, group, panel)
      },
    })
  }

  if (items.length > 0) {
    items.push('separator')
  }

  items.push(
    {
      label: 'Crear grup de tabs',
      action: () => {
        createTabGroupWithPanel(api, groupId, panel.id)
      },
    },
  )

  for (const tabGroup of tabGroups) {
    if (currentTabGroup?.id === tabGroup.id) {
      continue
    }

    items.push({
      label: `Afegir a «${tabGroup.label}»`,
      action: () => {
        addPanelToExistingTabGroup(api, groupId, tabGroup.id, panel.id)
      },
    })
  }

  if (currentTabGroup) {
    items.push(
      'separator',
      {
        label: 'Treure del grup',
        action: () => {
          removePanelFromTabGroup(api, groupId, panel.id)
        },
      },
    )
  }

  return items
}

export function getMiradorTabGroupChipContextMenuItems(
  params: GetTabGroupChipContextMenuItemsParams,
): TabGroupChipContextMenuItem[] {
  const { tabGroup, group, api } = params

  return [
    'rename',
    'colorPicker',
    'separator',
    {
      label: tabGroup.collapsed ? 'Expandir grup' : 'Replegar grup',
      action: () => {
        tabGroup.toggle()
      },
    },
    {
      label: 'Dissoldre grup',
      action: () => {
        dissolveTabGroup(api, group.id, tabGroup.id)
      },
    },
  ]
}
