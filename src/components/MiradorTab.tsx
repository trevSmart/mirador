import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { IDockviewDefaultTabProps } from 'dockview-react'
import { getPanelTypeFromComponent, isPanelClosable } from '../panels/panel-actions'
import { isPanelPinned } from '../panels/pin-actions'
import { parseDetailPanelParams, isDetailPanelComponent } from '../detail/detail-panel'
import { DetailTabIcon } from '../components/detail/DetailTabIcon'
import { PanelIcon } from '../panels/PanelIcon'
import { scrollPanelToTop } from '../hooks/useSmoothScroll'
import { AppIcon } from '../components/ds/AppIcon'

function TabCloseButton() {
  return <AppIcon name="close" size={11} />
}

function TabPinIndicator() {
  return (
    <span className="mirador-tab__pin" aria-label="Tab fixat">
      <AppIcon name="pinned" size={11} />
    </span>
  )
}

export function MiradorTab({
  api,
  containerApi,
  hideClose,
  closeActionOverride,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  tabLocation: _tabLocation,
  params: _params,
  ...rest
}: IDockviewDefaultTabProps) {
  // tabLocation/params are pulled out so they aren't spread onto the DOM node.
  void _tabLocation
  void _params

  // El títol del panell és un store extern (dockview): la subscripció i
  // l'snapshot van juntes via useSyncExternalStore, que reconcilia l'snapshot
  // just després de subscriure's i evita perdre un canvi emès entre el render
  // i la subscripció.
  const title = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => {
        const disposable = api.onDidTitleChange(() => onStoreChange())
        return () => disposable.dispose()
      },
      [api],
    ),
    () => api.title,
  )
  const isMiddleMouseButton = useRef(false)
  // Whether this tab's panel was already the active one when the press started.
  // Captured on pointerdown (before dockview processes the activation) so the
  // click handler can tell a re-click of the visible tab from a tab switch.
  const wasActiveOnPress = useRef(false)
  const panel = containerApi.panels.find((item) => item.id === api.id)
  const panelType = getPanelTypeFromComponent(panel?.view.contentComponent)
  const closable = panelType ? isPanelClosable(panelType) : true
  const pinned = panel ? isPanelPinned(panel) : false
  // Un tab fixat no mostra la X (com als navegadors): es tanca via el menú
  // contextual després d'alliberar-lo, i és immune als tancaments massius.
  const effectiveHideClose = hideClose || !closable || pinned
  const detailParams = isDetailPanelComponent(panel?.view.contentComponent)
    ? parseDetailPanelParams(panel?.params)
    : null

  const onClose = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      if (!closable) {
        return
      }
      if (closeActionOverride) {
        closeActionOverride()
      } else {
        api.close()
      }
    },
    [api, closeActionOverride, closable],
  )

  const onBtnPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isMiddleMouseButton.current = event.button === 1
      wasActiveOnPress.current = api.isActive
      onPointerDown?.(event)
    },
    [api, onPointerDown],
  )

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Clicking the already-visible tab scrolls its panel content to the top.
      // The handler only runs when this tab was already active, so its panel is
      // the group's active panel. A group can hold several panels' content in
      // the DOM at once (inactive ones hidden), so pick the visible shell —
      // the one whose content container isn't display:none — rather than the
      // first in document order.
      if (event.button !== 0 || !wasActiveOnPress.current) {
        return
      }
      const group = event.currentTarget.closest('.dv-groupview')
      if (!group) {
        return
      }
      const shells = Array.from(group.querySelectorAll<HTMLElement>('.panel-shell'))
      const visibleShell =
        shells.find((shell) => shell.offsetParent !== null) ?? shells[0] ?? null
      scrollPanelToTop(visibleShell)
    },
    [],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMiddleMouseButton.current && event.button === 1 && !effectiveHideClose) {
        isMiddleMouseButton.current = false
        onClose(event)
      }
      onPointerUp?.(event)
    },
    [onClose, effectiveHideClose, onPointerUp],
  )

  const handlePointerLeave = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isMiddleMouseButton.current = false
      onPointerLeave?.(event)
    },
    [onPointerLeave],
  )

  return (
    <div
      data-testid="dockview-dv-default-tab"
      {...rest}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className="dv-default-tab"
    >
      <span className="dv-default-tab-content mirador-tab__content">
        {detailParams ? (
          <span className="mirador-tab__icon mirador-tab__icon--detail">
            <DetailTabIcon target={detailParams} />
          </span>
        ) : panelType ? (
          <span className="mirador-tab__icon">
            <PanelIcon type={panelType} sldsSize="x-small" />
          </span>
        ) : null}
        <span className="mirador-tab__label">{title}</span>
      </span>
      {!effectiveHideClose ? (
        <div
          className="dv-default-tab-action"
          onPointerDown={onBtnPointerDown}
          onClick={onClose}
        >
          <TabCloseButton />
        </div>
      ) : pinned ? (
        <TabPinIndicator />
      ) : null}
    </div>
  )
}
