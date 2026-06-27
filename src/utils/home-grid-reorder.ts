import { useCallback, useRef } from 'react'
import autoAnimate, { getTransitionSizes, type AutoAnimationPlugin } from '@formkit/auto-animate'

type Coords = { top: number; left: number; width: number; height: number }

const HOME_GRID_REORDER = {
  duration: 280,
  easing: 'cubic-bezier(0.34, 1.24, 0.64, 1)',
} as const

/** Card opacity while it is moving — keeps the floor in focus for supervisors. */
const MOVE_OPACITY = 0.18

function remainDeltas(oldCoords: Coords, newCoords: Coords) {
  let deltaLeft = oldCoords.left - newCoords.left
  let deltaTop = oldCoords.top - newCoords.top
  const deltaRight = oldCoords.left + oldCoords.width - (newCoords.left + newCoords.width)
  const deltaBottom = oldCoords.top + oldCoords.height - (newCoords.top + newCoords.height)
  if (deltaBottom === 0) deltaTop = 0
  if (deltaRight === 0) deltaLeft = 0
  return { deltaLeft, deltaTop }
}

function homeGridReorderPlugin(el: Element, action: 'add' | 'remove' | 'remain', a?: Coords, b?: Coords) {
  if (action === 'remain' && a && b) {
    const oldCoords = a as Coords
    const newCoords = b as Coords
    const { deltaLeft, deltaTop } = remainDeltas(oldCoords, newCoords)
    const [widthFrom, widthTo, heightFrom, heightTo] = getTransitionSizes(el, oldCoords, newCoords)

    const start: Keyframe = {
      transform: `translate(${deltaLeft}px, ${deltaTop}px)`,
      opacity: MOVE_OPACITY,
    }
    const end: Keyframe = {
      transform: 'translate(0, 0)',
      opacity: 1,
    }
    if (widthFrom !== widthTo) {
      start.width = `${widthFrom}px`
      end.width = `${widthTo}px`
    }
    if (heightFrom !== heightTo) {
      start.height = `${heightFrom}px`
      end.height = `${heightTo}px`
    }

    return new KeyframeEffect(el, [start, end], {
      duration: HOME_GRID_REORDER.duration,
      easing: HOME_GRID_REORDER.easing,
    })
  }

  if (action === 'add' && a) {
    return new KeyframeEffect(
      el,
      [
        { transform: 'scale(.98)', opacity: MOVE_OPACITY },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: HOME_GRID_REORDER.duration * 1.5, easing: 'ease-in' },
    )
  }

  if (action === 'remove' && a) {
    return new KeyframeEffect(
      el,
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(.98)', opacity: MOVE_OPACITY * 0.6 },
      ],
      { duration: HOME_GRID_REORDER.duration, easing: 'ease-out' },
    )
  }
}

/** Attach auto-animate without the hook's setState re-render (avoids racing the queue grid). */
export function useGridAutoAnimate<T extends HTMLElement>() {
  const destroyRef = useRef<(() => void) | null>(null)
  return useCallback((node: T | null) => {
    destroyRef.current?.()
    destroyRef.current = null
    if (node) {
      const controller = autoAnimate(node, homeGridReorderPlugin as AutoAnimationPlugin)
      destroyRef.current = controller.destroy ?? null
    }
  }, [])
}
