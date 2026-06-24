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

  const items: MiradorTabContextMenuItem[] = [
    {
      label: 'Tancar',
      action: () => panel.api.close(),
    },
    {
      label: 'Tancar les altres',
      action: () => {
        group.panels
          .filter((entry) => entry !== panel)
          .forEach((entry) => entry.api.close())
      },
    },
    {
      label: 'Tancar totes',
      action: () => {
        ;[...group.panels].forEach((entry) => entry.api.close())
      },
    },
    'separator',
    {
      label: 'Crear grup de tabs',
      action: () => {
        createTabGroupWithPanel(api, groupId, panel.id)
      },
    },
  ]

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
