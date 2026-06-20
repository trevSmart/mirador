import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDockviewDefaultTabProps } from 'dockview'
import { getPanelTypeFromComponent } from '../panels/panel-actions'
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
      <path d="M2.8 2.8l22.4 22.4M25.2 2.8L2.8 25.2" />
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
  const [title, setTitle] = useState(api.title)
  const isMiddleMouseButton = useRef(false)
  // Whether this tab's panel was already the active one when the press started.
  // Captured on pointerdown (before dockview processes the activation) so the
  // click handler can tell a re-click of the visible tab from a tab switch.
  const wasActiveOnPress = useRef(false)
  const panel = containerApi.panels.find((item) => item.id === api.id)
  const panelType = getPanelTypeFromComponent(panel?.view.contentComponent)

  useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title)
    })

    if (title !== api.title) {
      setTitle(api.title)
    }

    return () => {
      disposable.dispose()
    }
  }, [api, title])

  const onClose = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      if (closeActionOverride) {
        closeActionOverride()
      } else {
        api.close()
      }
    },
    [api, closeActionOverride],
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
      if (isMiddleMouseButton.current && event.button === 1 && !hideClose) {
        isMiddleMouseButton.current = false
        onClose(event)
      }
      onPointerUp?.(event)
    },
    [onClose, hideClose, onPointerUp],
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
        {panelType ? (
          <span className="mirador-tab__icon">
            <PanelIcon type={panelType} size={18} />
          </span>
        ) : null}
        {title}
      </span>
      {!hideClose ? (
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
