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
