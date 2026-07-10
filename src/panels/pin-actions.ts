import type { DockviewApi, IDockviewPanel } from 'dockview-react'

/**
 * L'estat de "fixat" (pin) d'un tab viu dins dels params del panell, de manera
 * que dockview el serialitza a `toJSON()` i sobreviu a la persistència del
 * layout sense cap emmagatzematge paral·lel.
 */
export function isPanelPinned(panel: IDockviewPanel): boolean {
  return (panel.params as Record<string, unknown> | undefined)?.pinned === true
}

export function setPanelPinned(panel: IDockviewPanel, pinned: boolean): void {
  // `undefined` esborra la clau dels params (dockview la treu del serialitzat),
  // així un tab alliberat no arrossega soroll al layout desat.
  panel.api.updateParameters({ pinned: pinned ? true : undefined })
}

/**
 * Reordena de manera estable deixant primer els elements fixats i després la
 * resta, preservant l'ordre relatiu dins de cada zona. És la regla que manté
 * els tabs fixats sempre a l'esquerra i impedeix barrejar les dues zones: en
 * reaplicar-la després d'un drag, un tab que hagi creuat la frontera torna a
 * quedar arran d'ella.
 */
export function orderByPinned<T>(items: readonly T[], pinned: (item: T) => boolean): T[] {
  const pinnedItems = items.filter(pinned)
  const rest = items.filter((item) => !pinned(item))
  return [...pinnedItems, ...rest]
}

/**
 * Força, a cada grup de dockview, que els panells fixats quedin a l'esquerra.
 * Es reaplica després de cada canvi de layout (drags inclosos), de manera que
 * la reordenació només és possible dins de cada zona.
 *
 * S'omet qualsevol grup que contingui "grups de tabs" (els grups de colors),
 * perquè aquests imposen la seva pròpia contigüitat i barrejar-hi la regla de
 * fixats provocaria moviments en conflicte.
 */
export function enforcePinnedOrder(api: DockviewApi): boolean {
  let moved = false
  for (const group of api.groups) {
    if (api.getTabGroups({ groupId: group.id }).length > 0) {
      continue
    }
    const current = group.panels
    const desired = orderByPinned(current, isPanelPinned)
    for (let index = 0; index < desired.length; index += 1) {
      // `group.panels` és un getter viu: es rellegeix a cada volta perquè cada
      // moveTo reordena l'array.
      if (group.panels[index]?.id !== desired[index].id) {
        desired[index].api.moveTo({ group, index })
        moved = true
      }
    }
  }
  return moved
}
