import type { DockviewApi, ITabGroup } from 'dockview-react'

const TAB_GROUP_COLORS = ['blue', 'green', 'purple', 'orange', 'cyan', 'pink'] as const

let tabGroupCounter = 0

export function createTabGroupWithPanel(
  api: DockviewApi,
  groupId: string,
  panelId: string,
  label?: string,
): ITabGroup {
  tabGroupCounter += 1
  const tabGroup = api.createTabGroup({
    groupId,
    label: label ?? `Grup ${tabGroupCounter}`,
    color: TAB_GROUP_COLORS[(tabGroupCounter - 1) % TAB_GROUP_COLORS.length],
  })

  api.addPanelToTabGroup({
    groupId,
    tabGroupId: tabGroup.id,
    panelId,
  })

  return tabGroup
}

export function addPanelToExistingTabGroup(
  api: DockviewApi,
  groupId: string,
  tabGroupId: string,
  panelId: string,
): void {
  api.addPanelToTabGroup({
    groupId,
    tabGroupId,
    panelId,
  })
}

export function removePanelFromTabGroup(
  api: DockviewApi,
  groupId: string,
  panelId: string,
): void {
  api.removePanelFromTabGroup({
    groupId,
    panelId,
  })
}

export function dissolveTabGroup(
  api: DockviewApi,
  groupId: string,
  tabGroupId: string,
): void {
  api.dissolveTabGroup({
    groupId,
    tabGroupId,
  })
}
