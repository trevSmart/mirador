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
  placeOpening,
  placeDivider,
  eraseCellRect,
  resolveEdit,
  elementAt,
  canDropMoved,
  moveSeat,
  moveOpening,
  moveDivider,
  rectBlocked,
} from './space-plan-model'
import type { Cell, SpacePlanData, Folder, Space } from './types'

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
    let node: Folder = { id: 'leaf', name: 'x', image: null, active: true, spaces: [space('sx')], folders: [] }
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
  const space = (id: string, active = true) => ({ id, name: id, cells: [[0, 0]] as [number, number][], seats: [], openings: [], dividers: [], dir: 0 as const, active })
  const plan = (folders: Folder[]): SpacePlanData => ({ v: 4, activeFolderId: null, activeSpaceId: null, folders })

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

describe('editing tools (additive model)', () => {
  const room = (over: Partial<Space> = {}): Space => ({
    id: 's',
    name: 'P',
    // 2×2 room at origin
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
    seats: [],
    openings: [],
    dividers: [],
    dir: 0,
    active: true,
    ...over,
  })

  describe('placeOpening', () => {
    it('places a door on an exterior edge', () => {
      const out = placeOpening(room(), 0, 0, 'N', 'door')
      expect(out.openings).toEqual([{ c: 0, r: 0, edge: 'N', kind: 'door' }])
    })

    it('is a no-op when repeating the same kind (never toggles off)', () => {
      const one = placeOpening(room(), 0, 0, 'N', 'door')
      expect(placeOpening(one, 0, 0, 'N', 'door')).toBe(one)
    })

    it('replaces a different kind on the same edge', () => {
      const door = placeOpening(room(), 0, 0, 'N', 'door')
      const out = placeOpening(door, 0, 0, 'N', 'window')
      expect(out.openings).toEqual([{ c: 0, r: 0, edge: 'N', kind: 'window' }])
    })

    it('rejects an interior edge', () => {
      const s = room()
      expect(placeOpening(s, 0, 0, 'E', 'door')).toBe(s)
    })
  })

  describe('placeDivider', () => {
    it('places a divider on an interior edge, canonically', () => {
      const out = placeDivider(room(), 1, 0, 'O')
      expect(out.dividers).toEqual([{ c: 0, r: 0, edge: 'E' }])
    })

    it('is idempotent (second click never removes)', () => {
      const one = placeDivider(room(), 0, 0, 'E')
      expect(placeDivider(one, 1, 0, 'O')).toBe(one)
    })

    it('rejects an exterior edge', () => {
      const s = room()
      expect(placeDivider(s, 0, 0, 'N')).toBe(s)
    })
  })

  describe('eraseCellRect', () => {
    it('erases the rectangle with its seats', () => {
      const s = room({ cells: [[0, 0], [1, 0], [2, 0]], seats: [{ c: 2, r: 0, agentId: 'a1' }] })
      const out = eraseCellRect(s, [1, 0], [2, 0])
      expect(out.cells).toEqual([[0, 0]])
      expect(out.seats).toEqual([])
    })

    it('rejects an erase that would split the room into islands', () => {
      const s = room({ cells: [[0, 0], [1, 0], [2, 0]] })
      expect(eraseCellRect(s, [1, 0], [1, 0])).toBe(s)
    })

    it('is a no-op when the rectangle misses the area', () => {
      const s = room()
      expect(eraseCellRect(s, [5, 5], [6, 6])).toBe(s)
    })
  })

  describe('resolveEdit', () => {
    it('build on an empty adjacent cell, block on a detached one', () => {
      expect(resolveEdit(room(), 'cell', 2, 0, null, false).intent).toBe('build')
      expect(resolveEdit(room(), 'cell', 5, 5, null, false).intent).toBe('block')
      expect(resolveEdit(room(), 'cell', 0, 0, null, false).intent).toBe('noop')
    })

    it('seat tool: build on bare floor, select on an existing seat', () => {
      const s = room({ seats: [{ c: 0, r: 0, agentId: null }] })
      expect(resolveEdit(s, 'seat', 0, 0, null, false).intent).toBe('select')
      expect(resolveEdit(s, 'seat', 1, 0, null, false).intent).toBe('build')
      expect(resolveEdit(s, 'seat', 5, 5, null, false).intent).toBe('noop')
    })

    it('door: build on a bare exterior edge, replace over a window, noop over itself', () => {
      const s = placeOpening(room(), 0, 0, 'N', 'window')
      expect(resolveEdit(s, 'door', 0, 0, 'N', false).intent).toBe('replace')
      expect(resolveEdit(s, 'door', 1, 0, 'N', false).intent).toBe('build')
      expect(resolveEdit(s, 'window', 0, 0, 'N', false).intent).toBe('noop')
      expect(resolveEdit(s, 'door', 0, 0, 'E', false).intent).toBe('noop')
    })

    it('erasing wins over the active tool and blocks island-splitting erases', () => {
      const bar = room({ cells: [[0, 0], [1, 0], [2, 0]], seats: [{ c: 0, r: 0, agentId: null }] })
      expect(resolveEdit(bar, 'cell', 0, 0, null, true)).toMatchObject({ intent: 'erase', target: 'seat' })
      expect(resolveEdit(bar, 'cell', 2, 0, null, true)).toMatchObject({ intent: 'erase', target: 'cell' })
      expect(resolveEdit(bar, 'cell', 1, 0, null, true).intent).toBe('block')
      expect(resolveEdit(bar, 'cell', 5, 5, null, true).intent).toBe('noop')
    })

    it('erasing an edge element resolves to an edge erase', () => {
      const s = placeOpening(room(), 0, 0, 'N', 'door')
      expect(resolveEdit(s, 'erase', 0, 0, 'N', true)).toMatchObject({ intent: 'erase', target: 'edge' })
    })
  })

  describe('move (elementAt / canDropMoved / moveSeat / moveOpening / moveDivider)', () => {
    const furnished = () => {
      let s = room({ seats: [{ c: 0, r: 0, agentId: 'a1' }] })
      s = placeOpening(s, 0, 0, 'N', 'door')
      s = placeDivider(s, 0, 0, 'E')
      return s
    }

    it('elementAt finds openings/dividers by edge and seats by cell', () => {
      const s = furnished()
      expect(elementAt(s, 0, 0, 'N')).toEqual({ kind: 'opening', c: 0, r: 0, edge: 'N' })
      // Divider refs come back canonicalized (edge E/S) to match the stored form.
      expect(elementAt(s, 1, 0, 'O')).toEqual({ kind: 'divider', c: 0, r: 0, edge: 'E' })
      expect(elementAt(s, 0, 0, null)).toEqual({ kind: 'seat', c: 0, r: 0 })
      expect(elementAt(s, 1, 1, null)).toBeNull()
    })

    it('moveSeat relocates keeping the agent, rejects occupied or off-floor targets', () => {
      const s = furnished()
      const out = moveSeat(s, [0, 0], [1, 1])
      expect(out.seats).toEqual([{ c: 1, r: 1, agentId: 'a1' }])
      expect(moveSeat(s, [0, 0], [5, 5])).toBe(s)
      const two = { ...s, seats: [...s.seats, { c: 1, r: 1, agentId: null }] }
      expect(moveSeat(two, [0, 0], [1, 1])).toBe(two)
    })

    it('moveOpening relocates to another exterior edge and replaces what sits there', () => {
      let s = furnished()
      s = placeOpening(s, 1, 0, 'N', 'window')
      const out = moveOpening(s, [0, 0], 'N', [1, 0], 'N')
      expect(out.openings).toEqual([{ c: 1, r: 0, edge: 'N', kind: 'door' }])
      expect(moveOpening(s, [0, 0], 'N', [0, 0], 'E')).toBe(s)
    })

    it('moveDivider relocates between interior edges, canonically', () => {
      const s = furnished()
      const out = moveDivider(s, [1, 0], 'O', [0, 1], 'E')
      expect(out.dividers).toEqual([{ c: 0, r: 1, edge: 'E' }])
      expect(moveDivider(s, [0, 0], 'E', [0, 0], 'N')).toBe(s)
    })

    it('canDropMoved anticipates the model rules for each kind', () => {
      const s = furnished()
      expect(canDropMoved(s, { kind: 'seat', c: 0, r: 0 }, 1, 1, null)).toBe(true)
      expect(canDropMoved(s, { kind: 'seat', c: 0, r: 0 }, 5, 5, null)).toBe(false)
      expect(canDropMoved(s, { kind: 'opening', c: 0, r: 0, edge: 'N' }, 1, 0, 'N')).toBe(true)
      expect(canDropMoved(s, { kind: 'opening', c: 0, r: 0, edge: 'N' }, 0, 0, 'E')).toBe(false)
      expect(canDropMoved(s, { kind: 'divider', c: 0, r: 0, edge: 'E' }, 0, 1, 'E')).toBe(true)
      expect(canDropMoved(s, { kind: 'divider', c: 0, r: 0, edge: 'E' }, 0, 0, 'N')).toBe(false)
    })
  })
})

describe('rectBlocked (live drag preview)', () => {
  const bar: Space = {
    id: 's', name: 'P', cells: [[0, 0], [1, 0], [2, 0]],
    seats: [], openings: [], dividers: [], dir: 0, active: true,
  }

  it('flags an erase that would split the room', () => {
    expect(rectBlocked(bar, [1, 0], [1, 0], true)).toBe(true)
    expect(rectBlocked(bar, [2, 0], [2, 0], true)).toBe(false)
  })

  it('an erase rect over empty ground is a noop, not blocked', () => {
    expect(rectBlocked(bar, [5, 5], [6, 6], true)).toBe(false)
  })

  it('flags a paint rect that does not touch the existing area', () => {
    expect(rectBlocked(bar, [5, 5], [6, 6], false)).toBe(true)
    expect(rectBlocked(bar, [3, 0], [4, 0], false)).toBe(false)
  })

  it('never blocks the first rect on an empty space', () => {
    const empty = { ...bar, cells: [] as Cell[] }
    expect(rectBlocked(empty, [5, 5], [6, 6], false)).toBe(false)
  })
})
