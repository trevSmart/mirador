import { useCallback, useLayoutEffect, useRef } from 'react'

/* FLIP reorder animation for the Home grids.

   This used to be an @formkit/auto-animate plugin, but auto-animate works by
   watching DOM mutations and re-inserting/re-positioning nodes itself — racing
   React's commit phase and intermittently crashing with `insertBefore`
   NotFoundError when a data poll changed the top-5 membership. Here the FLIP
   runs in a layout effect after each commit and only ever layers WAAPI
   transform/opacity animations on top of nodes React placed; exiting cards are
   animated as ghosts in a separate fixed layer React never manages. React
   stays the sole owner of the grid's DOM. */

const HOME_GRID_REORDER = {
  duration: 280,
  easing: 'cubic-bezier(0.34, 1.24, 0.64, 1)',
} as const

/** Card opacity while it is moving — keeps the space in focus for supervisors. */
const MOVE_OPACITY = 0.18

interface Snapshot {
  /** Layout position relative to the offset parent — immune to scroll and to running transforms. */
  left: number
  top: number
  width: number
  height: number
  /** Viewport rect from the last commit, used to place exit ghosts. */
  rect: DOMRect
}

function measure(el: HTMLElement): Snapshot {
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    rect: el.getBoundingClientRect(),
  }
}

function remainDeltas(oldCoords: Snapshot, newCoords: Snapshot) {
  let deltaLeft = oldCoords.left - newCoords.left
  let deltaTop = oldCoords.top - newCoords.top
  const deltaRight = oldCoords.left + oldCoords.width - (newCoords.left + newCoords.width)
  const deltaBottom = oldCoords.top + oldCoords.height - (newCoords.top + newCoords.height)
  if (deltaBottom === 0) deltaTop = 0
  if (deltaRight === 0) deltaLeft = 0
  return { deltaLeft, deltaTop }
}

function animateMove(el: HTMLElement, oldCoords: Snapshot, newCoords: Snapshot): Animation | null {
  const { deltaLeft, deltaTop } = remainDeltas(oldCoords, newCoords)
  const sameSize = oldCoords.width === newCoords.width && oldCoords.height === newCoords.height
  if (deltaLeft === 0 && deltaTop === 0 && sameSize) return null

  const start: Keyframe = {
    transform: `translate(${deltaLeft}px, ${deltaTop}px)`,
    opacity: MOVE_OPACITY,
  }
  const end: Keyframe = {
    transform: 'translate(0, 0)',
    opacity: 1,
  }
  if (oldCoords.width !== newCoords.width) {
    start.width = `${oldCoords.width}px`
    end.width = `${newCoords.width}px`
  }
  if (oldCoords.height !== newCoords.height) {
    start.height = `${oldCoords.height}px`
    end.height = `${newCoords.height}px`
  }

  return el.animate([start, end], {
    duration: HOME_GRID_REORDER.duration,
    easing: HOME_GRID_REORDER.easing,
  })
}

function animateEnter(el: HTMLElement): Animation {
  return el.animate(
    [
      { transform: 'scale(.98)', opacity: MOVE_OPACITY },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: HOME_GRID_REORDER.duration * 1.5, easing: 'ease-in' },
  )
}

/* Exit ghosts live in a fixed full-viewport layer appended to <body>, outside
   any React-managed subtree. Kept below scrims/popovers (see --z-scrim). */
let ghostLayer: HTMLDivElement | null = null

function getGhostLayer(): HTMLDivElement {
  if (!ghostLayer || !ghostLayer.isConnected) {
    ghostLayer = document.createElement('div')
    // inert (i no només aria-hidden): els ghosts són nodes reals amb
    // tabIndex, i cal treure'ls també del tab order mentre s'esvaeixen.
    ghostLayer.inert = true
    ghostLayer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:100;'
    document.body.appendChild(ghostLayer)
  }
  return ghostLayer
}

function animateExit(el: HTMLElement, last: Snapshot) {
  // React has already detached `el` from the grid, so reusing the node keeps
  // the exact rendered appearance without React ever seeing it again.
  el.style.position = 'fixed'
  el.style.margin = '0'
  el.style.left = `${last.rect.left}px`
  el.style.top = `${last.rect.top}px`
  el.style.width = `${last.rect.width}px`
  el.style.height = `${last.rect.height}px`
  getGhostLayer().appendChild(el)
  const animation = el.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(.98)', opacity: MOVE_OPACITY * 0.6 },
    ],
    { duration: HOME_GRID_REORDER.duration, easing: 'ease-out' },
  )
  const cleanup = () => el.remove()
  animation.onfinish = cleanup
  animation.oncancel = cleanup
}

/** FLIP-animate reorders of a grid's direct children without ever mutating
 *  React-owned DOM. Returns a ref callback for the grid container; the layout
 *  effect diffs child positions after every commit of the calling component. */
export function useGridFlipReorder<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null)
  const snapshots = useRef(new Map<HTMLElement, Snapshot>())
  const running = useRef(new Map<HTMLElement, Animation>())
  const primed = useRef(false)
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const pendingRefresh = useRef(0)

  const attach = useCallback((node: T | null) => {
    resizeObserver.current?.disconnect()
    resizeObserver.current = null
    cancelAnimationFrame(pendingRefresh.current)
    containerRef.current = node
    snapshots.current.clear()
    running.current.clear()
    primed.current = false
    if (node) {
      // Re-snapshot on container resize so the next reorder doesn't animate
      // from stale coordinates (e.g. after a dockview split is dragged).
      resizeObserver.current = new ResizeObserver(() => {
        for (const el of snapshots.current.keys()) {
          if (el.isConnected) snapshots.current.set(el, measure(el))
        }
      })
      resizeObserver.current.observe(node)
    }
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    cancelAnimationFrame(pendingRefresh.current)
    const prev = snapshots.current

    // Same children in the same order → React moved nothing, so there is no
    // animation to run. Measuring here anyway would force a synchronous reflow
    // inside the commit (brutal right after a global style invalidation like a
    // theme switch, where it re-lays-out the whole page). Refresh the
    // snapshots once the browser has painted instead — reads on clean layout
    // are near-free — so a later reorder still animates from fresh coords.
    const children = [...container.children].filter((c): c is HTMLElement => c instanceof HTMLElement)
    const prevOrder = [...prev.keys()]
    if (primed.current && children.length === prevOrder.length && children.every((el, i) => el === prevOrder[i])) {
      pendingRefresh.current = requestAnimationFrame(() => {
        pendingRefresh.current = requestAnimationFrame(() => {
          const fresh = new Map<HTMLElement, Snapshot>()
          for (const el of children) {
            if (el.isConnected) fresh.set(el, measure(el))
          }
          snapshots.current = fresh
        })
      })
      return
    }

    const next = new Map<HTMLElement, Snapshot>()
    for (const child of children) next.set(child, measure(child))

    if (primed.current) {
      for (const [el, last] of prev) {
        if (next.has(el)) continue
        running.current.get(el)?.cancel()
        running.current.delete(el)
        animateExit(el, last)
      }
      for (const [el, coords] of next) {
        const before = prev.get(el)
        running.current.get(el)?.cancel()
        const animation = before ? animateMove(el, before, coords) : animateEnter(el)
        if (animation) running.current.set(el, animation)
        else running.current.delete(el)
      }
    }

    snapshots.current = next
    primed.current = true
  })

  return attach
}
