import { useEffect, useRef, useState } from 'react'

/** Fallback used if `transitionend` never fires (see below); a touch above the
    0.35s CSS transition so it only ever acts as a safety net. */
const SETTLE_FALLBACK_MS = 420

/**
 * Collapse/expand state shared by every collapsible surface (panel groups,
 * drawer sections…). `toggle` flips collapsed and marks the transition as
 * running in the same synchronous update, so there's never a frame where an
 * opening body is briefly treated as settled (which would flash overflow).
 *
 * `animating` is normally cleared by the body's `transitionend`, but two toggles
 * inside one frame cancel out to no net `open` change — so no transition runs
 * and `transitionend` never fires. A timeout guarantees `animating` always
 * clears, otherwise it would stick true and leave the body's overflow clipped.
 */
export function useCollapsible(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const toggle = () => {
    setCollapsed((value) => !value)
    setAnimating(true)
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setAnimating(false)
    }, SETTLE_FALLBACK_MS)
  }

  const settle = () => {
    clearTimer()
    setAnimating(false)
  }

  useEffect(() => clearTimer, [])

  return { collapsed, open: !collapsed, animating, toggle, settle }
}
