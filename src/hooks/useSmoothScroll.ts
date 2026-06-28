import { useCallback, useRef } from 'react'
import Lenis from 'lenis'

/**
 * Registry mapping a scroll container element to its live Lenis instance, so
 * code outside the hook (e.g. a tab click handler) can drive that panel's
 * smooth scroll without threading refs through the component tree.
 */
const lenisByElement = new WeakMap<HTMLElement, Lenis>()

/**
 * Live set of every element that currently has a Lenis instance. A WeakMap
 * isn't enumerable, so this lets `scrollPanelToTop` discover the real scroll
 * containers *inside* a shell — needed for layouts like Home, whose shell is
 * `overflow:hidden` and whose scrollable content lives in nested columns.
 */
const registeredScrollers = new Set<HTMLElement>()

/** Scrolls a single element to the top, via its Lenis instance if registered. */
function scrollElementToTop(element: HTMLElement): void {
  const lenis = lenisByElement.get(element)
  if (lenis) {
    lenis.scrollTo(0)
  } else {
    element.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

/**
 * Smoothly scrolls a panel back to the top. The shell itself may be the scroll
 * container (most panels) or may delegate scrolling to nested columns (Home is
 * `overflow:hidden` with two scrollable columns), so we scroll the shell *and*
 * every registered Lenis scroller living inside it. Falls back to a native
 * scroll when an element has no Lenis instance (e.g. reduced motion).
 */
export function scrollPanelToTop(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  scrollElementToTop(element)
  for (const scroller of registeredScrollers) {
    if (scroller !== element && element.contains(scroller)) {
      scrollElementToTop(scroller)
    }
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
    registeredScrollers.add(element)

    let rafId = 0
    const runRaf = () => {
      rafId = requestAnimationFrame(function raf(time) {
        lenis.raf(time)
        rafId = requestAnimationFrame(raf)
      })
    }

    // Dockview moves panels in and out of the DOM directly (not through React),
    // so when the user switches panels the element is *disconnected* and later
    // *reconnected* — the same node — without React ever re-running this ref.
    // Two failures follow if unhandled: (1) a raf loop on a detached element
    // pegs the CPU and poisons Lenis's cached scroll limit (it measures 0×0);
    // (2) on return, nothing rebuilds Lenis, so smooth scroll is dead.
    //
    // So: pause the raf loop while detached, and watch the document for the
    // element being reattached to resume it (with a resize() so Lenis re-reads
    // the now-visible dimensions). The instance is only destroyed when React
    // truly unmounts the component (cleanup.current below, fired with null).
    const observer = new MutationObserver(() => {
      const connected = element.isConnected
      if (connected && rafId === 0) {
        lenis.resize()
        runRaf()
      } else if (!connected && rafId !== 0) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })

    const teardown = () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
      lenisByElement.delete(element)
      registeredScrollers.delete(element)
      lenis.destroy()
      cleanup.current = null
    }

    if (element.isConnected) runRaf()

    cleanup.current = teardown
  }, [])
}
