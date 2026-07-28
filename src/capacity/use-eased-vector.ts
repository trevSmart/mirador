import { useEffect, useRef, useState } from 'react'

/** Matches `--dur-value` in index.css — the token for "a displayed value changed". */
const DURATION_MS = 450

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOut(t: number): number {
  // Approximates --ease: cubic-bezier(.22, .61, .36, 1)
  return 1 - Math.pow(1 - t, 3)
}

function unchanged(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Eases a flat numeric vector toward `target` over `--dur-value`.
 *
 * Pack EVERY quantity the rendered geometry derives from into one vector —
 * a screen position is typically `f(value, scale)`, and easing only the value
 * leaves the scale to jump, which reads as "it snapped somewhere else, then
 * animated from there". One vector also guarantees every component shares a
 * single start time and duration, so they move as one.
 *
 * `immediate` snaps instead of animating: while a pointer drag is in flight
 * the pointer is the source of truth and must never lag behind it.
 *
 * The animation's start value comes from a ref updated synchronously each
 * frame, not from the `shown` state closure, which can lag a render behind
 * when targets arrive back-to-back.
 */
export function useEasedVector(target: number[], immediate: boolean): number[] {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  const rafRef = useRef(0)
  const mounted = useRef(false)
  const prevTargetRef = useRef(target)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      prevTargetRef.current = target
      shownRef.current = target
      return
    }
    const prevTarget = prevTargetRef.current
    prevTargetRef.current = target

    const snap = () => {
      cancelAnimationFrame(rafRef.current)
      shownRef.current = target
      setShown(target)
    }

    if (immediate) {
      snap()
      return
    }
    // Same contents via a fresh array identity: leave any in-flight animation
    // alone. Snapping here would abort a running tween mid-way.
    if (unchanged(target, prevTarget)) return
    if (shownRef.current.length !== target.length || prefersReducedMotion()) {
      snap()
      return
    }

    const from = shownRef.current
    cancelAnimationFrame(rafRef.current)
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOut(t)
      const next = from.map((v, i) => v + (target[i] - v) * eased)
      shownRef.current = next
      setShown(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
     
  }, [target, immediate])

  return immediate ? target : shown
}
