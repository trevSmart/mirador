import { describe, expect, it } from 'vitest'
import {
  uniqueName,
  sanitizeImage,
  sanitizeSpacePlan,
  parseStoredSpacePlan,
  toWireSpacePlan,
  defaultSpacePlan,
  prepareImportedFolders,
  visibleSpaces,
  visibleSpaceFolders,
  seedFolder,
  MAX_FOLDER_DEPTH,
} from './space-plan-model'
import type { SpacePlanData } from './types'

describe('uniqueName', () => {
  it('returns the base name when there is no collision', () => {
    expect(uniqueName('Lloc', ['Altre'])).toBe('Lloc')
  })

  it('appends a numeric suffix on collision, skipping taken numbers', () => {
    expect(uniqueName('Lloc', ['Lloc'])).toBe('Lloc 2')
    expect(uniqueName('Lloc', ['Lloc', 'Lloc 2'])).toBe('Lloc 3')
  })
})

describe('sanitizeImage', () => {
  it('accepts a valid png data-URL', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeImage(url)).toBe(url)
  })
  it('accepts jpeg, webp and svg data-URLs', () => {
    for (const mime of ['jpeg', 'jpg', 'webp', 'svg+xml']) {
      const url = `data:image/${mime};base64,AAAA`
      expect(sanitizeImage(url)).toBe(url)
    }
  })
  it('rejects non-image strings and non-strings', () => {
    expect(sanitizeImage('hello')).toBeNull()
    expect(sanitizeImage('data:text/plain;base64,AAAA')).toBeNull()
    expect(sanitizeImage(42)).toBeNull()
    expect(sanitizeImage(null)).toBeNull()
  })
  it('rejects an over-long data-URL', () => {
    const url = 'data:image/png;base64,' + 'A'.repeat(200_000)
    expect(sanitizeImage(url)).toBeNull()
  })
})

describe('seedFolder', () => {
  it('creates an active, empty folder with no image', () => {
    const folder = seedFolder('Lloc 1')
    expect(folder.name).toBe('Lloc 1')
    expect(folder.active).toBe(true)
    expect(folder.image).toBeNull()
    expect(folder.folders).toEqual([])
    expect(folder.spaces).toEqual([])
  })
})

describe('defaultSpacePlan (v4 folders)', () => {
  it('returns one root folder holding one space, both active', () => {
    const plan = defaultSpacePlan()
    expect(plan.v).toBe(4)
    expect(plan.folders).toHaveLength(1)
    expect(plan.folders[0].active).toBe(true)
    expect(plan.folders[0].spaces).toHaveLength(1)
    expect(plan.folders[0].spaces[0].active).toBe(true)
    expect(plan.activeFolderId).toBe(plan.folders[0].id)
    expect(plan.activeSpaceId).toBe(plan.folders[0].spaces[0].id)
  })
})

describe('sanitizeSpacePlan (v4 folder tree)', () => {
  const space = (id: string) => ({ id, name: 'P', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true })

  it('keeps nested folders, images and empty folders', () => {
    const raw = {
      v: 4,
      activeFolderId: 'f1',
      activeSpaceId: null,
      folders: [
        { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [
          { id: 'f2', name: 'B', image: null, active: true, spaces: [], folders: [] },
        ] },
      ],
    }
    const out = sanitizeSpacePlan(raw)
    expect(out).not.toBeNull()
    expect(out!.folders[0].folders[0].id).toBe('f2') // empty folder preserved
  })

  it('rejects a non-v4 schema', () => {
    expect(sanitizeSpacePlan({ v: 3, sites: [] })).toBeNull()
  })

  it('caps recursion at MAX_FOLDER_DEPTH', () => {
    let node: any = { id: 'leaf', name: 'x', image: null, active: true, spaces: [space('sx')], folders: [] }
    for (let i = 0; i < MAX_FOLDER_DEPTH + 5; i += 1) {
      node = { id: `f${i}`, name: 'x', image: null, active: true, spaces: [], folders: [node] }
    }
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: null, activeSpaceId: null, folders: [node] })
    // Walk down and assert depth never exceeds the cap.
    let depth = 0
    let cur = out!.folders[0]
    while (cur.folders.length > 0) { depth += 1; cur = cur.folders[0] }
    expect(depth + 1).toBeLessThanOrEqual(MAX_FOLDER_DEPTH)
  })

  it('falls back activeFolderId/activeSpaceId when the referenced ids are gone', () => {
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: 'nope', activeSpaceId: 'nope', folders: [
      { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [] },
    ] })
    expect(out!.activeFolderId).toBe('f1')
    expect(out!.activeSpaceId).toBe('s1')
  })

  it('defaults missing active flags to true (legacy folders)', () => {
    const raw = {
      v: 4,
      activeFolderId: null,
      activeSpaceId: null,
      folders: [
        { id: 'f1', name: 'A', image: null, spaces: [{ id: 's1', name: 'P', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0 }], folders: [] },
      ],
    }
    const out = sanitizeSpacePlan(raw)
    expect(out!.folders[0].active).toBe(true)
    expect(out!.folders[0].spaces[0].active).toBe(true)
  })

  it('preserves an explicit active=false at every level', () => {
    const raw = {
      v: 4,
      activeFolderId: null,
      activeSpaceId: null,
      folders: [
        { id: 'f1', name: 'A', image: null, active: false, spaces: [space('s1')], folders: [] },
      ],
    }
    const out = sanitizeSpacePlan(raw)
    expect(out!.folders[0].active).toBe(false)
  })
})

describe('parseStoredSpacePlan / toWireSpacePlan (v4)', () => {
  it('round-trips a v4 folder plan', () => {
    const plan = defaultSpacePlan()
    const wire = toWireSpacePlan(plan)
    expect(wire.v).toBe(4)
    const back = parseStoredSpacePlan(wire)
    expect(back!.folders[0].name).toBe('Lloc 1')
  })

  it('rejects a non-v4 payload (no legacy migration)', () => {
    expect(parseStoredSpacePlan({ v: 2, places: [] })).toBeNull()
    expect(parseStoredSpacePlan({ v: 3, sites: [] })).toBeNull()
    expect(parseStoredSpacePlan(null)).toBeNull()
  })
})

describe('prepareImportedFolders', () => {
  const plan = () => ({
    v: 4, activeFolderId: 'f1', activeSpaceId: 's1',
    folders: [{ id: 'f1', name: 'Lloc', image: 'data:image/png;base64,AAAA', active: true, folders: [], spaces: [
      { id: 's1', name: 'Planta', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true },
    ] }],
  })

  it('rejects an incompatible schema version', () => {
    expect(prepareImportedFolders({ v: 2, places: [] }, [])).toBeNull()
  })

  it('recreates folders with fresh ids and preserves images and active flags', () => {
    const out = prepareImportedFolders(plan(), [])
    expect(out).not.toBeNull()
    expect(out![0].id).not.toBe('f1')
    expect(out![0].spaces[0].id).not.toBe('s1')
    expect(out![0].image).toBe('data:image/png;base64,AAAA')
    expect(out![0].active).toBe(true)
  })

  it('de-dupes top-level folder names against existing names', () => {
    const out = prepareImportedFolders(plan(), ['Lloc'])
    expect(out![0].name).toBe('Lloc 2')
  })
})

describe('visibleSpaces / visibleSpaceFolders', () => {
  const space = (id: string, active = true) => ({ id, name: id, cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active })
  const plan = (folders: any[]): SpacePlanData => ({ v: 4, activeFolderId: null, activeSpaceId: null, folders })

  it('returns only active spaces of a folder', () => {
    const f = { id: 'f', name: 'F', image: null, active: true, folders: [], spaces: [space('s1'), space('s2', false)] }
    expect(visibleSpaces(f).map((s) => s.id)).toEqual(['s1'])
  })

  it('lists folders that directly hold a visible space, with their path', () => {
    const child = { id: 'c', name: 'Child', image: null, active: true, folders: [], spaces: [space('s1')] }
    const root = { id: 'r', name: 'Root', image: null, active: true, folders: [child], spaces: [] }
    const out = visibleSpaceFolders(plan([root]))
    expect(out).toHaveLength(1)
    expect(out[0].folder.id).toBe('c')
    expect(out[0].path).toEqual(['Root', 'Child'])
  })

  it('hides a folder (and descendants) when it is inactive', () => {
    const child = { id: 'c', name: 'Child', image: null, active: true, folders: [], spaces: [space('s1')] }
    const root = { id: 'r', name: 'Root', image: null, active: false, folders: [child], spaces: [] }
    expect(visibleSpaceFolders(plan([root]))).toHaveLength(0)
  })

  it('hides a folder whose only space is inactive', () => {
    const root = { id: 'r', name: 'Root', image: null, active: true, folders: [], spaces: [space('s1', false)] }
    expect(visibleSpaceFolders(plan([root]))).toHaveLength(0)
  })
})
