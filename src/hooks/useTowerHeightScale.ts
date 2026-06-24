import { useEffect, useRef, useState } from 'react'

/** Matches `--dur-bar` in index.css. */
const DURATION_MS = 600

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOut(t: number): number {
  // Approximates --ease: cubic-bezier(.22, .61, .36, 1)
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Smoothly interpolates tower height when capacity changes. Uses rAF instead
 * of CSS transform so SVG polygon geometry animates reliably.
 */
export function useTowerHeightScale(targetH: number, enabled: boolean): number {
  const [h, setH] = useState(targetH)
  const rafRef = useRef(0)

  // Snap during render (no effect setState) when animation isn't wanted or the
  // gap is negligible. Reading `h` (state) here is fine; reading a ref isn't.
  const [prevTarget, setPrevTarget] = useState(targetH)
  const shouldAnimate = enabled && !prefersReducedMotion() && Math.abs(h - targetH) >= 0.5
  if (prevTarget !== targetH) {
    setPrevTarget(targetH)
    if (!shouldAnimate) setH(targetH)
  }

  useEffect(() => {
    if (!shouldAnimate) return

    const from = h
    cancelAnimationFrame(rafRef.current)
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setH(from + (targetH - from) * easeOut(t))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setH(targetH)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // `h` is the animation's start value, captured once when targetH changes;
    // intentionally excluded so mid-flight setH calls don't restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetH, shouldAnimate])

  return h
}
