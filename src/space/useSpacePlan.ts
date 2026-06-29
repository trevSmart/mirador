/* Space editor — React state hook.
   Owns the working plan, the selected tool/seat, undo/redo history and the
   dirty/save lifecycle. Keeps a ref mirror of the data so action callbacks never
   read stale state, and delegates every mutation to the pure model functions. */

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
  makeId,
  prepareImportedPlaces,
  seedSpace,
  toggleDivider,
  toggleOpening,
  toggleSeat,
  uniqueName,
} from './space-plan-model'
import type { Cell, Dir, Edge, Space, SpacePlanData, SpaceTool, Place } from './types'

export interface SeatRef {
  c: number
  r: number
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(length - 1, Math.max(0, index))
}

function placeIndex(d: SpacePlanData, placeId: string): number {
  const pi = d.places.findIndex((p) => p.id === placeId)
  return pi >= 0 ? pi : Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
}

export function useSpacePlan() {
  const { isMockMode } = useAuth()
  const client = useMiradorApi()
  const [data, setData] = useState<SpacePlanData>(() => defaultSpacePlan())
  const [tool, setToolState] = useState<SpaceTool>('cell')
  const [activeSpaceIndex, setActiveSpaceIndex] = useState(0)
  const [selectedSeat, setSelectedSeat] = useState<SeatRef | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [savedSignature, setSavedSignature] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const dataRef = useRef(data)
  const toolRef = useRef(tool)
  const spaceIndexRef = useRef(activeSpaceIndex)
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
  useEffect(() => {
    spaceIndexRef.current = activeSpaceIndex
  }, [activeSpaceIndex])

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
      setActiveSpaceIndex(0)
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

  const updateActiveSpace = useCallback(
    (fn: (space: Space) => Space, recordHistory = true) => {
      apply((d) => {
        const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
        const place = d.places[pi]
        if (!place) return d
        const fi = clampIndex(spaceIndexRef.current, place.spaces.length)
        const space = place.spaces[fi]
        if (!space) return d
        const nextSpace = fn(space)
        if (nextSpace === space) return d
        const spaces = place.spaces.map((f, i) => (i === fi ? nextSpace : f))
        const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
        return { ...d, places }
      }, recordHistory)
    },
    [apply],
  )

  /* ── Derived selectors ──────────────────────────────────────────────── */
  const activePlaceIndex = Math.max(0, data.places.findIndex((p) => p.id === data.activePlaceId))
  const activePlace = data.places[activePlaceIndex] ?? data.places[0]
  const safeSpaceIndex = clampIndex(activeSpaceIndex, activePlace?.spaces.length ?? 0)
  const activeSpace = activePlace?.spaces[safeSpaceIndex] ?? null

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

  /* ── Place / space management ───────────────────────────────────────── */
  const selectPlace = useCallback((placeId: string) => {
    apply((d) => (d.activePlaceId === placeId ? d : { ...d, activePlaceId: placeId }), false)
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const selectSpace = useCallback((placeId: string, index: number) => {
    apply((d) => (d.activePlaceId === placeId ? d : { ...d, activePlaceId: placeId }), false)
    setActiveSpaceIndex(index)
    setSelectedSeat(null)
  }, [apply])

  const addPlace = useCallback(() => {
    apply((d) => {
      const names = d.places.map((p) => p.name)
      const place: Place = {
        id: makeId('place'),
        name: uniqueName(`Lloc ${d.places.length + 1}`, names),
        spaces: [seedSpace('Planta 1')],
      }
      return { ...d, places: [...d.places, place], activePlaceId: place.id }
    })
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const removePlace = useCallback((placeId: string) => {
    apply((d) => {
      if (d.places.length <= 1) return d
      const places = d.places.filter((p) => p.id !== placeId)
      const activePlaceId = d.activePlaceId === placeId ? places[0].id : d.activePlaceId
      return { ...d, places, activePlaceId }
    })
    setActiveSpaceIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const renamePlace = useCallback((placeId: string, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => ({
      ...d,
      places: d.places.map((p) => (p.id === placeId ? { ...p, name: trimmed } : p)),
    }))
  }, [apply])

  const addSpace = useCallback((placeId: string) => {
    let newIndex = 0
    apply((d) => {
      const pi = placeIndex(d, placeId)
      const place = d.places[pi]
      if (!place) return d
      const names = place.spaces.map((f) => f.name)
      const space = seedSpace(uniqueName(`Planta ${place.spaces.length + 1}`, names))
      const spaces = [...place.spaces, space]
      newIndex = spaces.length - 1
      const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
      return { ...d, places, activePlaceId: place.id }
    })
    setActiveSpaceIndex(newIndex)
    setSelectedSeat(null)
  }, [apply])

  const removeSpace = useCallback((placeId: string, index: number) => {
    apply((d) => {
      const pi = placeIndex(d, placeId)
      const place = d.places[pi]
      if (!place || place.spaces.length <= 1) return d
      const spaces = place.spaces.filter((_, i) => i !== index)
      const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
      return { ...d, places, activePlaceId: place.id }
    })
    setActiveSpaceIndex((cur) => Math.max(0, cur > index ? cur - 1 : cur === index ? cur - 1 : cur))
    setSelectedSeat(null)
  }, [apply])

  const duplicateSpace = useCallback((placeId: string, index: number) => {
    let newIndex = index
    apply((d) => {
      const pi = placeIndex(d, placeId)
      const place = d.places[pi]
      const source = place?.spaces[index]
      if (!place || !source) return d
      const names = place.spaces.map((f) => f.name)
      const copy = cloneSpace(source, uniqueName(`${source.name} (còpia)`, names))
      const spaces = [...place.spaces.slice(0, index + 1), copy, ...place.spaces.slice(index + 1)]
      newIndex = index + 1
      const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
      return { ...d, places, activePlaceId: place.id }
    })
    setActiveSpaceIndex(newIndex)
    setSelectedSeat(null)
  }, [apply])

  const renameSpace = useCallback((placeId: string, index: number, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => {
      const pi = placeIndex(d, placeId)
      const place = d.places[pi]
      if (!place || !place.spaces[index]) return d
      const spaces = place.spaces.map((f, i) => (i === index ? { ...f, name: trimmed } : f))
      const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
      return { ...d, places }
    })
  }, [apply])

  const reorderSpace = useCallback((placeId: string, from: number, to: number) => {
    if (from === to) return
    apply((d) => {
      const pi = placeIndex(d, placeId)
      const place = d.places[pi]
      if (!place) return d
      const spaces = [...place.spaces]
      if (from < 0 || from >= spaces.length || to < 0 || to >= spaces.length) return d
      const [moved] = spaces.splice(from, 1)
      spaces.splice(to, 0, moved)
      const places = d.places.map((p, i) => (i === pi ? { ...p, spaces } : p))
      return { ...d, places, activePlaceId: place.id }
    })
    setActiveSpaceIndex(to)
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

  /** Download the full working plan (all places + spaces) as a JSON file. */
  const exportJson = useCallback(() => {
    const current = dataRef.current
    downloadTextFile(
      `mirador-plans-${dateStamp()}.json`,
      JSON.stringify(current, null, 2),
    )
  }, [])

  /** Import places from a JSON file, additively: each imported place/space is a
      brand-new record (fresh ids) appended to the current plan, with place names
      de-duplicated. Nothing existing is ever overwritten or removed. */
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
      const existingNames = dataRef.current.places.map((p) => p.name)
      const imported = prepareImportedPlaces(raw, existingNames)
      if (!imported || imported.length === 0) {
        setImportError('Fitxer incompatible o invàlid')
        return
      }
      apply((d) => ({ ...d, places: [...d.places, ...imported] }))
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
      setActiveSpaceIndex(0)
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
    places: data.places,
    activePlace,
    activeSpace,
    activeSpaceIndex: safeSpaceIndex,
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
    selectPlace,
    selectSpace,
    addPlace,
    removePlace,
    renamePlace,
    addSpace,
    removeSpace,
    duplicateSpace,
    renameSpace,
    reorderSpace,
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
