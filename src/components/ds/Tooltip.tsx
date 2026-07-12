import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DROPDOWN_TRANSITION_MS, syncDropdownPanel } from '../../utils/sync-dropdown-panel'

interface TooltipProps {
  /** Element the tooltip is anchored to. */
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  content: ReactNode
}

/** Small fixed tooltip portalled to <body> so it escapes overflow clipping. */
export function Tooltip({ anchorRef, open, content }: TooltipProps) {
  const tipRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const sync = () => {
      const rect = anchor.getBoundingClientRect()
      setCoords({ x: rect.left + rect.width / 2, y: rect.top })
    }
    sync()
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open && coords) {
      const unmountId = setTimeout(() => setCoords(null), DROPDOWN_TRANSITION_MS)
      return () => clearTimeout(unmountId)
    }
    return undefined
  }, [open, coords])

  useEffect(() => {
    if (!coords) return
    closeTimeoutRef.current = syncDropdownPanel(tipRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open, coords])

  if (!coords) return null

  return createPortal(
    <div
      ref={tipRef}
      className="mi-tooltip dropdown-panel"
      role="tooltip"
      hidden
      style={{
        position: 'fixed',
        left: coords.x,
        top: coords.y,
        zIndex: 200,
      }}
    >
      {content}
    </div>,
    document.body,
  )
}
