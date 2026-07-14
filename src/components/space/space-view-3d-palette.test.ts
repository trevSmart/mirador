import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPACE_VIEW_3D_PALETTE } from './space-view-3d-palette'

// Vitest corre amb el root del repo com a cwd; import.meta.url no és file:.
const indexCss = readFileSync('src/index.css', 'utf8')

function leavesOf(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]]
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([k, v]) => leavesOf(v, path ? `${path}.${k}` : k))
}

describe('SPACE_VIEW_3D_PALETTE', () => {
  const leaves = leavesOf(SPACE_VIEW_3D_PALETTE)

  it('every leaf is a --fv3d-* variable reference', () => {
    expect(leaves.length).toBeGreaterThan(0)
    for (const [path, leaf] of leaves) {
      expect(leaf, path).toMatch(/^var\(--fv3d-[a-z0-9-]+\)$/)
    }
  })

  it('every referenced variable is defined in index.css for both themes', () => {
    // Colors shared between themes are defined once under :root, so require at
    // least one definition; theme pairs naturally appear twice.
    for (const [path, leaf] of leaves) {
      const name = leaf.slice('var('.length, -1)
      // Lookbehind so --fv3d-shade-left never matches inside
      // --fv3d-pedestal-shade-left.
      const definitions = indexCss.match(new RegExp(`(?<![\\w-])${name}:`, 'g')) ?? []
      expect(definitions.length, `${path} → ${name}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('the beam blend mode variable and its class exist in index.css', () => {
    expect((indexCss.match(/--fv3d-beam-blend:/g) ?? []).length).toBe(2)
    expect(indexCss).toContain('.fv3d-beam-vol')
  })
})
