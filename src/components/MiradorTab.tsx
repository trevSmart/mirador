import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDockviewDefaultTabProps } from 'dockview-react'
import { getPanelTypeFromComponent, isPanelClosable } from '../panels/panel-actions'
import { parseDetailPanelParams, isDetailPanelComponent } from '../detail/detail-panel'
import { DetailTabIcon } from '../components/detail/DetailTabIcon'
import { PanelIcon } from '../panels/PanelIcon'
import { scrollPanelToTop } from '../hooks/useSmoothScroll'

function TabCloseButton() {
  return (
    <svg
      height="11"
      width="11"
      viewBox="0 0 28 28"
      aria-hidden="false"
      focusable={false}
      className="dv-svg"
    >
      <path d="M2.1 27.3L0 25.2L11.55 13.65L0 2.1L2.1 0L13.65 11.55L25.2 0L27.3 2.1L15.75 13.65L27.3 25.2L25.2 27.3L13.65 15.75L2.1 27.3Z" />
    </svg>
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

  const [title, setTitle] = useState(api.title)
  // Keep the title synced with the panel during render (convergent); the effect
  // only subscribes to future title changes.
  const [trackedTitle, setTrackedTitle] = useState(api.title)
  if (trackedTitle !== api.title) {
    setTrackedTitle(api.title)
    setTitle(api.title)
  }
  const isMiddleMouseButton = useRef(false)
  // Whether this tab's panel was already the active one when the press started.
  // Captured on pointerdown (before dockview processes the activation) so the
  // click handler can tell a re-click of the visible tab from a tab switch.
  const wasActiveOnPress = useRef(false)
  const panel = containerApi.panels.find((item) => item.id === api.id)
  const panelType = getPanelTypeFromComponent(panel?.view.contentComponent)
  const closable = panelType ? isPanelClosable(panelType) : true
  const effectiveHideClose = hideClose || !closable
  const detailParams = isDetailPanelComponent(panel?.view.contentComponent)
    ? parseDetailPanelParams(panel?.params)
    : null

  useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title)
    })

    return () => {
      disposable.dispose()
    }
  }, [api])

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
      ) : null}
    </div>
  )
}
