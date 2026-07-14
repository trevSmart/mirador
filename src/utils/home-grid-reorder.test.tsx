import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useGridFlipReorder } from './home-grid-reorder'

// JSDOM doesn't implement ResizeObserver; stub it so the hook mounts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// JSDOM has no layout: derive offsets from DOM order so FLIP deltas are
// deterministic (each card is a 50×80 box stacked vertically, 100px apart).
Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
  configurable: true,
  get(this: HTMLElement) {
    return Array.prototype.indexOf.call(this.parentElement?.children ?? [], this) * 100
  },
})
Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
  configurable: true,
  get: () => 0,
})
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get: () => 50,
})
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get: () => 80,
})

interface FakeAnimation {
  cancel: () => void
  onfinish: (() => void) | null
  oncancel: (() => void) | null
}

let animations: Array<{ el: HTMLElement; keyframes: Keyframe[]; animation: FakeAnimation }> = []

// JSDOM has no WAAPI either; record calls so tests can assert on keyframes.
HTMLElement.prototype.animate = function (this: HTMLElement, keyframes: Keyframe[]) {
  const animation: FakeAnimation = { cancel: vi.fn(), onfinish: null, oncancel: null }
  animations.push({ el: this, keyframes, animation })
  return animation as unknown as Animation
}

function Grid({ items }: { items: string[] }) {
  const attach = useGridFlipReorder<HTMLDivElement>()
  return (
    <div data-testid="grid" ref={attach}>
      {items.map((item) => (
        <article key={item}>{item}</article>
      ))}
    </div>
  )
}

function childTexts(container: HTMLElement): string[] {
  const grid = container.querySelector('[data-testid="grid"]')!
  return Array.from(grid.children).map((el) => el.textContent ?? '')
}

describe('useGridFlipReorder', () => {
  beforeEach(() => {
    animations = []
  })

  it('does not animate the initial render', () => {
    render(<Grid items={['A', 'B']} />)
    expect(animations).toHaveLength(0)
  })

  it('FLIP-animates a reorder with the old→new position delta, without touching DOM order', () => {
    const { container, rerender } = render(<Grid items={['A', 'B']} />)
    rerender(<Grid items={['B', 'A']} />)

    // React alone decides the child order — the hook must never re-insert nodes.
    expect(childTexts(container)).toEqual(['B', 'A'])

    // B moved from offsetTop 100 to 0 → starts translated +100px back at its old spot.
    const moveB = animations.find((a) => a.el.textContent === 'B')!
    expect(moveB.keyframes[0]).toMatchObject({ transform: 'translate(0px, 100px)', opacity: 0.18 })
    expect(moveB.keyframes[1]).toMatchObject({ transform: 'translate(0, 0)', opacity: 1 })
    const moveA = animations.find((a) => a.el.textContent === 'A')!
    expect(moveA.keyframes[0]).toMatchObject({ transform: 'translate(0px, -100px)' })
  })

  it('skips elements that did not move', () => {
    const { rerender } = render(<Grid items={['A', 'B']} />)
    rerender(<Grid items={['A', 'B']} />)
    expect(animations).toHaveLength(0)
  })

  it('scale-animates entering elements', () => {
    const { rerender } = render(<Grid items={['A']} />)
    rerender(<Grid items={['A', 'C']} />)
    const enter = animations.find((a) => a.el.textContent === 'C')!
    expect(enter.keyframes[0]).toMatchObject({ transform: 'scale(.98)', opacity: 0.18 })
    expect(enter.keyframes[1]).toMatchObject({ transform: 'scale(1)', opacity: 1 })
  })

  it('animates removals as a ghost outside the grid and cleans it up on finish', () => {
    const { container, rerender } = render(<Grid items={['A', 'B']} />)
    const cardB = Array.from(container.querySelectorAll('article')).find((el) => el.textContent === 'B')!
    rerender(<Grid items={['A']} />)

    // The grid only holds what React rendered; the leaving card lives in the
    // fixed ghost layer under <body>, which React never manages.
    expect(childTexts(container)).toEqual(['A'])
    expect(cardB.parentElement).not.toBeNull()
    expect((cardB.parentElement as HTMLElement).inert).toBe(true)
    expect(cardB.parentElement!.parentElement).toBe(document.body)

    const exit = animations.find((a) => a.el === cardB)!
    expect(exit.keyframes[0]).toMatchObject({ transform: 'scale(1)', opacity: 1 })
    expect(exit.keyframes[1]).toMatchObject({ transform: 'scale(.98)' })

    exit.animation.onfinish?.()
    expect(cardB.parentElement).toBeNull()
  })

  it('still animates a reorder that follows a no-op commit (snapshot refresh is deferred)', () => {
    const { rerender } = render(<Grid items={['A', 'B']} />)
    // Same order → the hook skips the synchronous re-measure and defers it.
    rerender(<Grid items={['A', 'B']} />)
    // Reorder before the deferred refresh fires: the last good snapshots apply.
    rerender(<Grid items={['B', 'A']} />)
    const moveB = animations.find((a) => a.el.textContent === 'B')!
    expect(moveB.keyframes[0]).toMatchObject({ transform: 'translate(0px, 100px)', opacity: 0.18 })
  })

  it('cancels an in-flight animation before starting a new one on the same element', () => {
    const { rerender } = render(<Grid items={['A', 'B']} />)
    rerender(<Grid items={['B', 'A']} />)
    const first = animations.find((a) => a.el.textContent === 'A')!
    rerender(<Grid items={['A', 'B']} />)
    expect(first.animation.cancel).toHaveBeenCalled()
  })
})
