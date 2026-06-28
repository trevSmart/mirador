import { describe, expect, it } from 'vitest'
import { roomAspect } from './space-view-aspect'

describe('roomAspect', () => {
  it('returns the cols/rows ratio as a CSS aspect-ratio string', () => {
    expect(roomAspect(14, 5)).toBe('14 / 5')
  })

  it('reduces nothing — raw cols/rows is enough for CSS', () => {
    expect(roomAspect(10, 4)).toBe('10 / 4')
  })

  it('clamps non-positive dimensions to 1 to avoid an invalid ratio', () => {
    expect(roomAspect(0, 0)).toBe('1 / 1')
    expect(roomAspect(-3, 2)).toBe('1 / 2')
  })
})

import { render } from '@testing-library/react'
import { SpaceView } from './SpaceView'
import type { Space } from '../../space/types'

// JSDOM doesn't implement ResizeObserver; stub it so the component mounts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function makeSpace(): Space {
  // 3 cols × 2 rows room, one seat, no dividers/openings.
  return {
    id: 's1',
    name: 'Test',
    dir: 0,
    cells: [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
    ],
    seats: [{ c: 0, r: 0, agentId: null }],
    dividers: [],
    openings: [],
  } as unknown as Space
}

describe('SpaceView sizing contract', () => {
  it('declares the intrinsic aspect-ratio on the fit box and renders no grid-zoom wrapper', () => {
    const { container } = render(
      <SpaceView
        space={makeSpace()}
        dir={0}
        agentsById={new Map()}
        showAvatars={false}
        animations={false}
        onSelectAgent={() => {}}
      />,
    )
    const fit = container.querySelector('.fv-fit') as HTMLElement
    expect(fit).not.toBeNull()
    // 3 cols × 2 rows → "3 / 2"
    expect(fit.style.getPropertyValue('--fv-aspect')).toBe('3 / 2')
    // The old double-zoom wrapper is gone.
    expect(container.querySelector('.fv-grid-zoom')).toBeNull()
    // The grid still carries its raw intrinsic pixel size.
    const grid = container.querySelector('.fv-grid') as HTMLElement
    expect(grid.style.width).toBe('138px') // 3 * 46
    expect(grid.style.height).toBe('92px') // 2 * 46
  })
})
