/* Pure, immutable tree operations over the folder plan. No React. */
import type { Folder } from './types'

export function findFolder(folders: Folder[], id: string): Folder | null {
  for (const f of folders) {
    if (f.id === id) return f
    const nested = findFolder(f.folders, id)
    if (nested) return nested
  }
  return null
}

export function updateFolder(folders: Folder[], id: string, fn: (f: Folder) => Folder): Folder[] {
  return folders.map((f) => {
    if (f.id === id) return fn(f)
    if (f.folders.length === 0) return f
    const nested = updateFolder(f.folders, id, fn)
    return nested === f.folders ? f : { ...f, folders: nested }
  })
}

export function removeFolderById(folders: Folder[], id: string): Folder[] {
  return folders
    .filter((f) => f.id !== id)
    .map((f) => (f.folders.length === 0 ? f : { ...f, folders: removeFolderById(f.folders, id) }))
}

export function insertFolder(
  folders: Folder[],
  parentId: string | null,
  folder: Folder,
  index: number,
): Folder[] {
  if (parentId === null) {
    const next = [...folders]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, folder)
    return next
  }
  return updateFolder(folders, parentId, (parent) => {
    const children = [...parent.folders]
    children.splice(Math.max(0, Math.min(index, children.length)), 0, folder)
    return { ...parent, folders: children }
  })
}

export function folderContaining(folders: Folder[], spaceId: string): Folder | null {
  for (const f of folders) {
    if (f.spaces.some((s) => s.id === spaceId)) return f
    const nested = folderContaining(f.folders, spaceId)
    if (nested) return nested
  }
  return null
}
