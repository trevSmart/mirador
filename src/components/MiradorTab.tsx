import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDockviewDefaultTabProps } from 'dockview'
import { getPanelTypeFromComponent } from '../panels/panel-actions'
import { getPanelDefinition } from '../panels/registry'

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
  const panel = containerApi.panels.find((item) => item.id === api.id)
  const panelType = getPanelTypeFromComponent(panel?.view.contentComponent)
  const Icon = panelType ? getPanelDefinition(panelType).icon : null

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
      onPointerDown?.(event)
    },
    [onPointerDown],
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
      className="dv-default-tab"
    >
      <span className="dv-default-tab-content mirador-tab__content">
        {Icon ? (
          <span className="mirador-tab__icon">
            <Icon />
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
