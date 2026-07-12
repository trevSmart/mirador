import { describe, expect, it } from 'vitest'
import { SPACE_VIEW_3D_PALETTES } from './space-view-3d-palette'

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}

describe('SPACE_VIEW_3D_PALETTES', () => {
  it('light and dark expose the exact same key structure', () => {
    expect(keysOf(SPACE_VIEW_3D_PALETTES.light).sort()).toEqual(
      keysOf(SPACE_VIEW_3D_PALETTES.dark).sort(),
    )
  })

  it('every leaf is a non-empty string', () => {
    for (const palette of Object.values(SPACE_VIEW_3D_PALETTES)) {
      for (const key of keysOf(palette)) {
        const leaf = key.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], palette)
        expect(leaf, key).toBeTypeOf('string')
        expect((leaf as string).length, key).toBeGreaterThan(0)
      }
    }
  })
})
