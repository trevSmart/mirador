import { useCallback, useRef } from 'react'
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
  // A callback ref (not useRef + useEffect) so Lenis attaches the moment the
  // element actually mounts — even when it's rendered conditionally or after a
  // parent's early return, where a one-shot useEffect would see a null ref.
  const cleanup = useRef<(() => void) | null>(null)

  return useCallback((element: T | null) => {
    if (cleanup.current) {
      cleanup.current()
      cleanup.current = null
    }
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      wrapper: element,
      content: element,
      lerp: 0.18,
      smoothWheel: true,
      wheelMultiplier: 2.6,
      // macOS zoom uses ⌘+wheel (metaKey); Lenis only skips ctrlKey by default.
      virtualScroll: (data) => !data.event.ctrlKey && !data.event.metaKey,
    })
    lenisByElement.set(element, lenis)

    let rafId = 0
    const teardown = () => {
      cancelAnimationFrame(rafId)
      lenisByElement.delete(element)
      lenis.destroy()
      cleanup.current = null
    }

    // Mirador renders panels inside Dockview, which destroys panel DOM nodes
    // directly rather than through React's reconciler. When that happens React
    // never invokes this callback ref with `null`, so the cleanup below would
    // never run and Lenis's raf loop would leak — several orphaned loops pegged
    // the CPU at 100% on load. Guard the loop on `element.isConnected`: the
    // moment the element leaves the document, the instance self-destructs.
    rafId = requestAnimationFrame(function raf(time) {
      if (!element.isConnected) {
        teardown()
        return
      }
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    })

    cleanup.current = teardown
  }, [])
}
