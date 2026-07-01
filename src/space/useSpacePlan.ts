/* Space editor — React state hook.
   Owns the working plan, the selected tool/seat, undo/redo history and the
   dirty/save lifecycle. Keeps a ref mirror of the data so action callbacks never
   read stale state, and delegates every mutation to the pure model functions and
   the pure folder-tree operations. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { useMiradorApi } from '../api/mirador-api-context'
import { devLog } from '../dev/dev-log'
import { dateStamp, downloadTextFile } from '../utils/download'
import {
  loadSpacePlan,
  saveSpacePlan,
} from './space-plan-repository'
import {
  UNDO_LIMIT,
  addCellRect,
  assignAgentToSeat,
  cloneSpace,
  defaultSpacePlan,
  eraseCell,
  eraseEdge,
  spacePlanSignature,
  prepareImportedFolders,
  seedFolder,
  seedSpace,
  toggleDivider,
  toggleOpening,
  toggleSeat,
  uniqueName,
} from './space-plan-model'
import {
  findFolder,
  insertFolder,
  removeFolderById,
  updateFolder,
} from './space-tree-ops'
import type { Cell, Dir, Edge, Space, SpacePlanData, SpaceTool } from './types'

export interface SeatRef {
  c: number
  r: number
}

export function useSpacePlan() {
  const { isMockMode } = useAuth()
  const client = useMiradorApi()
  const [data, setData] = useState<SpacePlanData>(() => defaultSpacePlan())
  const [tool, setToolState] = useState<SpaceTool>('cell')
  const [selectedSeat, setSelectedSeat] = useState<SeatRef | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [savedSignature, setSavedSignature] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const dataRef = useRef(data)
  const toolRef = useRef(tool)
  const activeSpaceRef = useRef<Space | null>(null)
  const undoStack = useRef<SpacePlanData[]>([])
  const redoStack = useRef<SpacePlanData[]>([])

  // Mirror render state into refs so action callbacks read fresh values without
  // accessing refs during render (which the react-hooks rules disallow).
  useEffect(() => {
    dataRef.current = data
  }, [data])
  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  /* ── Load on mount / when data source changes ───────────────────────── */
  useEffect(() => {
    let cancelled = false
    void loadSpacePlan(client, isMockMode).then((stored) => {
      if (cancelled) return
      const next = stored ?? defaultSpacePlan()
      undoStack.current = []
      redoStack.current = []
      dataRef.current = next
      setData(next)
      setSavedSignature(spacePlanSignature(next))
      setSelectedSeat(null)
      syncHistoryFlags()
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [client, isMockMode, syncHistoryFlags])

  /* ── Core mutation plumbing ─────────────────────────────────────────── */
  const apply = useCallback((transform: (d: SpacePlanData) => SpacePlanData, recordHistory = true) => {
    const prev = dataRef.current
    const next = transform(prev)
    if (next === prev) return
    if (recordHistory) {
      undoStack.current = [...undoStack.current, prev].slice(-UNDO_LIMIT)
      redoStack.current = []
      syncHistoryFlags()
    }
    dataRef.current = next
    setData(next)
  }, [syncHistoryFlags])

  /** Mutate the space that is currently active (activeFolderId + activeSpaceId). */
  const updateActiveSpace = useCallback(
    (fn: (space: Space) => Space, recordHistory = true) => {
      apply((d) => {
        if (!d.activeFolderId || !d.activeSpaceId) return d
        const folders = updateFolder(d.folders, d.activeFolderId, (folder) => {
          const idx = folder.spaces.findIndex((s) => s.id === d.activeSpaceId)
          if (idx < 0) return folder
          const nextSpace = fn(folder.spaces[idx])
          if (nextSpace === folder.spaces[idx]) return folder
          return { ...folder, spaces: folder.spaces.map((s, i) => (i === idx ? nextSpace : s)) }
        })
        return folders === d.folders ? d : { ...d, folders }
      }, recordHistory)
    },
    [apply],
  )

  /* ── Derived selectors ──────────────────────────────────────────────── */
  const activeFolder = useMemo(
    () => (data.activeFolderId ? findFolder(data.folders, data.activeFolderId) : null),
    [data],
  )
  const activeSpace = useMemo(() => {
    if (!activeFolder || !data.activeSpaceId) return null
    return activeFolder.spaces.find((s) => s.id === data.activeSpaceId) ?? null
  }, [activeFolder, data.activeSpaceId])

  const dirty = useMemo(() => spacePlanSignature(data) !== savedSignature, [data, savedSignature])

  /* ── Tool actions (called by the grid) ──────────────────────────────── */
  const setTool = useCallback((next: SpaceTool) => {
    setToolState(next)
    if (next !== 'seat') setSelectedSeat(null)
  }, [])

  const paintCellRect = useCallback(
    (start: Cell, end: Cell) => updateActiveSpace((f) => addCellRect(f, start, end)),
    [updateActiveSpace],
  )

  const eraseCellAt = useCallback(
    (c: number, r: number) => {
      updateActiveSpace((f) => eraseCell(f, c, r))
      setSelectedSeat((cur) => (cur && cur.c === c && cur.r === r ? null : cur))
    },
    [updateActiveSpace],
  )

  /** Seat tool tap: create an empty seat if absent, and select the seat. */
  const seatAt = useCallback(
    (c: number, r: number) => {
      const space = activeSpaceRef.current
      if (!space) return
      const hasSeat = space.seats.some((s) => s.c === c && s.r === r)
      if (!hasSeat) updateActiveSpace((f) => toggleSeat(f, c, r))
      setSelectedSeat({ c, r })
    },
    [updateActiveSpace],
  )

  /** Edge tap dispatched by the current tool (door/window/divider/erase). */
  const applyEdge = useCallback(
    (c: number, r: number, edge: Edge) => {
      const t = toolRef.current
      updateActiveSpace((f) => {
        switch (t) {
          case 'door':
            return toggleOpening(f, c, r, edge, 'door')
          case 'window':
            return toggleOpening(f, c, r, edge, 'window')
          case 'divider':
            return toggleDivider(f, c, r, edge)
          case 'erase':
            return eraseEdge(f, c, r, edge)
          default:
            return f
        }
      })
    },
    [updateActiveSpace],
  )

  const rotateSpace = useCallback(
    (delta: 1 | -1) =>
      updateActiveSpace((f) => ({ ...f, dir: (((f.dir + delta) % 4) + 4) % 4 as Dir })),
    [updateActiveSpace],
  )

  /* ── Seat / agent actions (palette) ─────────────────────────────────── */
  const assignAgent = useCallback(
    (c: number, r: number, agentId: string | null) =>
      updateActiveSpace((f) => assignAgentToSeat(f, c, r, agentId)),
    [updateActiveSpace],
  )

  const removeSeat = useCallback(
    (c: number, r: number) => {
      updateActiveSpace((f) => toggleSeat(f, c, r))
      setSelectedSeat(null)
    },
    [updateActiveSpace],
  )

  /* ── Folder navigation + management ─────────────────────────────────── */
  const selectFolder = useCallback((id: string) => {
    apply((d) => {
      const folder = findFolder(d.folders, id)
      if (!folder) return d
      return { ...d, activeFolderId: id, activeSpaceId: folder.spaces[0]?.id ?? null }
    }, false)
    setSelectedSeat(null)
  }, [apply])

  const selectSpace = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({ ...d, activeFolderId: folderId, activeSpaceId: spaceId }), false)
    setSelectedSeat(null)
  }, [apply])

  const addFolder = useCallback((parentId: string | null) => {
    apply((d) => {
      const siblings = parentId ? (findFolder(d.folders, parentId)?.folders ?? []) : d.folders
      const folder = seedFolder(uniqueName(`Carpeta ${siblings.length + 1}`, siblings.map((f) => f.name)))
      return {
        ...d,
        folders: insertFolder(d.folders, parentId, folder, siblings.length),
        activeFolderId: folder.id,
        activeSpaceId: null,
      }
    })
    setSelectedSeat(null)
  }, [apply])

  const removeFolder = useCallback((id: string) => {
    apply((d) => {
      // Keep at least one root folder in the plan.
      if (d.folders.length <= 1 && d.folders[0]?.id === id) return d
      const folders = removeFolderById(d.folders, id)
      if (folders === d.folders) return d
      const stillActive = d.activeFolderId ? findFolder(folders, d.activeFolderId) : null
      const nextFolder = stillActive ?? folders[0] ?? null
      return {
        ...d,
        folders,
        activeFolderId: nextFolder?.id ?? null,
        activeSpaceId: nextFolder?.spaces[0]?.id ?? null,
      }
    })
    setSelectedSeat(null)
  }, [apply])

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, name: trimmed })) }))
  }, [apply])

  const toggleFolderActive = useCallback((id: string) => {
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, active: !f.active })) }))
  }, [apply])

  const setFolderImage = useCallback((id: string, dataUrl: string | null) => {
    apply((d) => ({ ...d, folders: updateFolder(d.folders, id, (f) => ({ ...f, image: dataUrl })) }))
  }, [apply])

  const moveFolder = useCallback((id: string, parentId: string | null, index: number) => {
    apply((d) => {
      const moving = findFolder(d.folders, id)
      if (!moving) return d
      // Reject dropping a folder onto itself or into its own subtree.
      if (parentId === id) return d
      if (parentId && findFolder(moving.folders, parentId)) return d
      const without = removeFolderById(d.folders, id)
      return { ...d, folders: insertFolder(without, parentId, moving, index) }
    })
  }, [apply])

  /* ── Space management ───────────────────────────────────────────────── */
  const addSpace = useCallback((folderId: string) => {
    apply((d) => {
      const folder = findFolder(d.folders, folderId)
      if (!folder) return d
      const space = seedSpace(uniqueName(`Planta ${folder.spaces.length + 1}`, folder.spaces.map((s) => s.name)))
      return {
        ...d,
        folders: updateFolder(d.folders, folderId, (f) => ({ ...f, spaces: [...f.spaces, space] })),
        activeFolderId: folderId,
        activeSpaceId: space.id,
      }
    })
    setSelectedSeat(null)
  }, [apply])

  const removeSpace = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => ({
        ...f,
        spaces: f.spaces.filter((s) => s.id !== spaceId),
      })),
      activeSpaceId: d.activeSpaceId === spaceId ? null : d.activeSpaceId,
    }))
    setSelectedSeat(null)
  }, [apply])

  const duplicateSpace = useCallback((folderId: string, spaceId: string) => {
    let newId = ''
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => {
        const idx = f.spaces.findIndex((s) => s.id === spaceId)
        if (idx < 0) return f
        const source = f.spaces[idx]
        const copy = cloneSpace(source, uniqueName(`${source.name} (còpia)`, f.spaces.map((s) => s.name)))
        newId = copy.id
        return { ...f, spaces: [...f.spaces.slice(0, idx + 1), copy, ...f.spaces.slice(idx + 1)] }
      }),
    }))
    if (newId) apply((d) => ({ ...d, activeFolderId: folderId, activeSpaceId: newId }), false)
    setSelectedSeat(null)
  }, [apply])

  const renameSpace = useCallback((folderId: string, spaceId: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => ({
        ...f,
        spaces: f.spaces.map((s) => (s.id === spaceId ? { ...s, name: trimmed } : s)),
      })),
    }))
  }, [apply])

  const toggleSpaceActive = useCallback((folderId: string, spaceId: string) => {
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => ({
        ...f,
        spaces: f.spaces.map((s) => (s.id === spaceId ? { ...s, active: !s.active } : s)),
      })),
    }))
  }, [apply])

  const moveSpace = useCallback((folderId: string, from: number, to: number) => {
    if (from === to) return
    apply((d) => ({
      ...d,
      folders: updateFolder(d.folders, folderId, (f) => {
        if (from < 0 || from >= f.spaces.length || to < 0 || to >= f.spaces.length) return f
        const spaces = [...f.spaces]
        const [moved] = spaces.splice(from, 1)
        spaces.splice(to, 0, moved)
        return { ...f, spaces }
      }),
    }))
    setSelectedSeat(null)
  }, [apply])

  /* ── History ────────────────────────────────────────────────────────── */
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    redoStack.current = [...redoStack.current, dataRef.current].slice(-UNDO_LIMIT)
    dataRef.current = prev
    setData(prev)
    syncHistoryFlags()
    setSelectedSeat(null)
  }, [syncHistoryFlags])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current[redoStack.current.length - 1]
    redoStack.current = redoStack.current.slice(0, -1)
    undoStack.current = [...undoStack.current, dataRef.current].slice(-UNDO_LIMIT)
    dataRef.current = next
    setData(next)
    syncHistoryFlags()
    setSelectedSeat(null)
  }, [syncHistoryFlags])

  /* ── Save / reset ───────────────────────────────────────────────────── */
  const save = useCallback(() => {
    const current = dataRef.current
    setSaveError(null)
    void saveSpacePlan(client, current, isMockMode)
      .then(() => {
        setSavedSignature(spacePlanSignature(current))
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        devLog.api('PUT', '/space-plan', `desat fallit: ${message}`)
        setSaveError(message)
      })
  }, [client, isMockMode])

  /** Download the full working plan (all folders + spaces) as a JSON file. */
  const exportJson = useCallback(() => {
    const current = dataRef.current
    downloadTextFile(
      `mirador-plans-${dateStamp()}.json`,
      JSON.stringify(current, null, 2),
    )
  }, [])

  /** Import folders from a JSON file, additively: each imported folder is a
      brand-new record (fresh ids) appended to the current plan, with top-level
      names de-duplicated. Nothing existing is ever overwritten or removed. */
  const importJson = useCallback(
    async (file: File) => {
      setImportError(null)
      let raw: unknown
      try {
        raw = JSON.parse(await file.text())
      } catch {
        setImportError('Fitxer incompatible o invàlid')
        return
      }
      const existingNames = dataRef.current.folders.map((f) => f.name)
      const imported = prepareImportedFolders(raw, existingNames)
      if (!imported || imported.length === 0) {
        setImportError('Fitxer incompatible o invàlid')
        return
      }
      apply((d) => ({ ...d, folders: [...d.folders, ...imported] }))
    },
    [apply],
  )

  const reset = useCallback(() => {
    void loadSpacePlan(client, isMockMode).then((stored) => {
      const next = stored ?? defaultSpacePlan()
      undoStack.current = []
      redoStack.current = []
      dataRef.current = next
      setData(next)
      setSavedSignature(spacePlanSignature(next))
      setSelectedSeat(null)
      syncHistoryFlags()
    })
  }, [client, isMockMode, syncHistoryFlags])

  // Keep the live active space reachable from callbacks that read it (seatAt).
  useEffect(() => {
    activeSpaceRef.current = activeSpace
  }, [activeSpace])

  return {
    loaded,
    data,
    folders: data.folders,
    activeFolder,
    activeSpace,
    tool,
    setTool,
    selectedSeat,
    selectSeat: setSelectedSeat,
    dirty,
    canUndo,
    canRedo,
    // tools
    paintCellRect,
    eraseCellAt,
    seatAt,
    applyEdge,
    rotateSpace,
    // agents
    assignAgent,
    removeSeat,
    // structure
    selectFolder,
    addFolder,
    removeFolder,
    renameFolder,
    toggleFolderActive,
    setFolderImage,
    moveFolder,
    selectSpace,
    addSpace,
    removeSpace,
    duplicateSpace,
    renameSpace,
    toggleSpaceActive,
    moveSpace,
    // history + persistence
    undo,
    redo,
    save,
    saveError,
    reset,
    exportJson,
    importJson,
    importError,
    clearImportError: () => setImportError(null),
  }
}
