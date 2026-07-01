import { describe, expect, it } from 'vitest'
import { findFolder, updateFolder, removeFolderById, insertFolder, folderContaining } from './space-tree-ops'
import type { Folder } from './types'

const space = (id: string) => ({ id, name: id, cells: [[0, 0]] as [number, number][], seats: [], openings: [], dividers: [], dir: 0 as const, active: true })
const tree = (): Folder[] => ([
  { id: 'r', name: 'R', image: null, active: true, spaces: [space('s0')], folders: [
    { id: 'c', name: 'C', image: null, active: true, spaces: [space('s1')], folders: [] },
  ] },
])

describe('space-tree-ops', () => {
  it('findFolder finds a nested folder', () => {
    expect(findFolder(tree(), 'c')?.name).toBe('C')
  })
  it('findFolder returns null for a missing id', () => {
    expect(findFolder(tree(), 'nope')).toBeNull()
  })
  it('updateFolder replaces a nested folder immutably', () => {
    const original = tree()
    const next = updateFolder(original, 'c', (f) => ({ ...f, name: 'C2' }))
    expect(findFolder(next, 'c')?.name).toBe('C2')
    expect(findFolder(original, 'c')?.name).toBe('C') // original untouched
  })
  it('removeFolderById drops a subtree', () => {
    expect(findFolder(removeFolderById(tree(), 'c'), 'c')).toBeNull()
  })
  it('insertFolder adds under a parent at an index', () => {
    const f: Folder = { id: 'n', name: 'N', image: null, active: true, spaces: [], folders: [] }
    const next = insertFolder(tree(), 'r', f, 0)
    expect(findFolder(next, 'r')?.folders[0].id).toBe('n')
  })
  it('insertFolder with null parent adds a root', () => {
    const f: Folder = { id: 'n', name: 'N', image: null, active: true, spaces: [], folders: [] }
    expect(insertFolder(tree(), null, f, 0)[0].id).toBe('n')
  })
  it('folderContaining locates the folder holding a space', () => {
    expect(folderContaining(tree(), 's1')?.id).toBe('c')
    expect(folderContaining(tree(), 's0')?.id).toBe('r')
  })
})
