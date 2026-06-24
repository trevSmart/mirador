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
  const hRef = useRef(targetH)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      hRef.current = targetH
      setH(targetH)
      return
    }

    const from = hRef.current
    if (Math.abs(from - targetH) < 0.5) {
      hRef.current = targetH
      setH(targetH)
      return
    }

    cancelAnimationFrame(rafRef.current)
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const next = from + (targetH - from) * easeOut(t)
      hRef.current = next
      setH(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        hRef.current = targetH
        setH(targetH)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [targetH, enabled])

  return h
}
