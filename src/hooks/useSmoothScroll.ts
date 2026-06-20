import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

/**
 * Registry mapping a scroll container element to its live Lenis instance, so
 * code outside the hook (e.g. a tab click handler) can drive that panel's
 * smooth scroll without threading refs through the component tree.
 */
const lenisByElement = new WeakMap<HTMLElement, Lenis>()

/**
 * Smoothly scrolls a registered scroll container back to the top. Falls back to
 * a native scroll when the element has no Lenis instance (e.g. reduced motion).
 */
export function scrollPanelToTop(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  const lenis = lenisByElement.get(element)
  if (lenis) {
    lenis.scrollTo(0)
  } else {
    element.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

/**
 * Attaches a Lenis smooth-scroll instance to a scrollable element (e.g. a panel
 * shell). Mirador scrolls inside each Dockview panel, not the window, so Lenis
 * is pointed at the element via `wrapper`/`content` rather than the default
 * `window` root. Returns a ref to spread onto the scroll container.
 *
 * Honors `prefers-reduced-motion`: when the user opts out of motion, no Lenis
 * instance is created and native scrolling is used.
 */
export function useSmoothScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const lenis = new Lenis({
      wrapper: element,
      content: element,
      lerp: 0.12,
      smoothWheel: true,
      wheelMultiplier: 1.8,
    })
    lenisByElement.set(element, lenis)

    let rafId = requestAnimationFrame(function raf(time) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    })

    return () => {
      cancelAnimationFrame(rafId)
      lenisByElement.delete(element)
      lenis.destroy()
    }
  }, [])

  return ref
}
