/* Floor editor — React state hook.
   Owns the working plan, the selected tool/seat, undo/redo history and the
   dirty/save lifecycle. Keeps a ref mirror of the data so action callbacks never
   read stale state, and delegates every mutation to the pure model functions. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import {
  loadFloorPlan,
  saveFloorPlan,
} from './floor-plan-repository'
import {
  UNDO_LIMIT,
  addCellRect,
  assignAgentToSeat,
  cloneFloor,
  defaultFloorPlan,
  eraseCell,
  eraseEdge,
  floorPlanSignature,
  makeId,
  seedFloor,
  setBackground,
  setBackgroundOpacity,
  toggleDivider,
  toggleOpening,
  toggleSeat,
} from './floor-plan-model'
import type { Cell, Dir, Edge, Floor, FloorPlanData, FloorTool, Place } from './types'

export interface SeatRef {
  c: number
  r: number
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(length - 1, Math.max(0, index))
}

/** Generate a unique "(còpia)"-style name within a list of existing names. */
function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

export function useFloorPlan() {
  const { isMockMode } = useAuth()
  const [data, setData] = useState<FloorPlanData>(() => defaultFloorPlan())
  const [tool, setToolState] = useState<FloorTool>('cell')
  const [activeFloorIndex, setActiveFloorIndex] = useState(0)
  const [selectedSeat, setSelectedSeat] = useState<SeatRef | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [savedSignature, setSavedSignature] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const dataRef = useRef(data)
  const toolRef = useRef(tool)
  const floorIndexRef = useRef(activeFloorIndex)
  const activeFloorRef = useRef<Floor | null>(null)
  const undoStack = useRef<FloorPlanData[]>([])
  const redoStack = useRef<FloorPlanData[]>([])

  // Mirror render state into refs so action callbacks read fresh values without
  // accessing refs during render (which the react-hooks rules disallow).
  useEffect(() => {
    dataRef.current = data
  }, [data])
  useEffect(() => {
    toolRef.current = tool
  }, [tool])
  useEffect(() => {
    floorIndexRef.current = activeFloorIndex
  }, [activeFloorIndex])

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  /* ── Load on mount / when data source changes ───────────────────────── */
  useEffect(() => {
    let cancelled = false
    void loadFloorPlan(isMockMode).then((stored) => {
      if (cancelled) return
      const next = stored ?? defaultFloorPlan()
      undoStack.current = []
      redoStack.current = []
      dataRef.current = next
      setData(next)
      setSavedSignature(floorPlanSignature(next))
      setActiveFloorIndex(0)
      setSelectedSeat(null)
      syncHistoryFlags()
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [isMockMode, syncHistoryFlags])

  /* ── Core mutation plumbing ─────────────────────────────────────────── */
  const apply = useCallback((transform: (d: FloorPlanData) => FloorPlanData, recordHistory = true) => {
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

  const updateActiveFloor = useCallback(
    (fn: (floor: Floor) => Floor, recordHistory = true) => {
      apply((d) => {
        const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
        const place = d.places[pi]
        if (!place) return d
        const fi = clampIndex(floorIndexRef.current, place.floors.length)
        const floor = place.floors[fi]
        if (!floor) return d
        const nextFloor = fn(floor)
        if (nextFloor === floor) return d
        const floors = place.floors.map((f, i) => (i === fi ? nextFloor : f))
        const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
        return { ...d, places }
      }, recordHistory)
    },
    [apply],
  )

  /* ── Derived selectors ──────────────────────────────────────────────── */
  const activePlaceIndex = Math.max(0, data.places.findIndex((p) => p.id === data.activePlaceId))
  const activePlace = data.places[activePlaceIndex] ?? data.places[0]
  const safeFloorIndex = clampIndex(activeFloorIndex, activePlace?.floors.length ?? 0)
  const activeFloor = activePlace?.floors[safeFloorIndex] ?? null

  const dirty = useMemo(() => floorPlanSignature(data) !== savedSignature, [data, savedSignature])

  /* ── Tool actions (called by the grid) ──────────────────────────────── */
  const setTool = useCallback((next: FloorTool) => {
    setToolState(next)
    if (next !== 'seat') setSelectedSeat(null)
  }, [])

  const paintCellRect = useCallback(
    (start: Cell, end: Cell) => updateActiveFloor((f) => addCellRect(f, start, end)),
    [updateActiveFloor],
  )

  const eraseCellAt = useCallback(
    (c: number, r: number) => {
      updateActiveFloor((f) => eraseCell(f, c, r))
      setSelectedSeat((cur) => (cur && cur.c === c && cur.r === r ? null : cur))
    },
    [updateActiveFloor],
  )

  /** Seat tool tap: create an empty seat if absent, and select the seat. */
  const seatAt = useCallback(
    (c: number, r: number) => {
      const floor = activeFloorRef.current
      if (!floor) return
      const hasSeat = floor.seats.some((s) => s.c === c && s.r === r)
      if (!hasSeat) updateActiveFloor((f) => toggleSeat(f, c, r))
      setSelectedSeat({ c, r })
    },
    [updateActiveFloor],
  )

  /** Edge tap dispatched by the current tool (door/window/divider/erase). */
  const applyEdge = useCallback(
    (c: number, r: number, edge: Edge) => {
      const t = toolRef.current
      updateActiveFloor((f) => {
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
    [updateActiveFloor],
  )

  const rotateFloor = useCallback(
    (delta: 1 | -1) =>
      updateActiveFloor((f) => ({ ...f, dir: (((f.dir + delta) % 4) + 4) % 4 as Dir })),
    [updateActiveFloor],
  )

  /* ── Seat / agent actions (palette) ─────────────────────────────────── */
  const assignAgent = useCallback(
    (c: number, r: number, agentId: string | null) =>
      updateActiveFloor((f) => assignAgentToSeat(f, c, r, agentId)),
    [updateActiveFloor],
  )

  const removeSeat = useCallback(
    (c: number, r: number) => {
      updateActiveFloor((f) => toggleSeat(f, c, r))
      setSelectedSeat(null)
    },
    [updateActiveFloor],
  )

  /* ── Background ─────────────────────────────────────────────────────── */
  const changeBackground = useCallback(
    (background: string | null) => updateActiveFloor((f) => setBackground(f, background)),
    [updateActiveFloor],
  )

  // Live slider updates don't pollute undo history.
  const changeBackgroundOpacity = useCallback(
    (opacity: number) => updateActiveFloor((f) => setBackgroundOpacity(f, opacity), false),
    [updateActiveFloor],
  )

  /* ── Place / floor management ───────────────────────────────────────── */
  const selectPlace = useCallback((placeId: string) => {
    apply((d) => (d.activePlaceId === placeId ? d : { ...d, activePlaceId: placeId }), false)
    setActiveFloorIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const selectFloor = useCallback((index: number) => {
    setActiveFloorIndex(index)
    setSelectedSeat(null)
  }, [])

  const addPlace = useCallback(() => {
    apply((d) => {
      const names = d.places.map((p) => p.name)
      const place: Place = {
        id: makeId('place'),
        name: uniqueName(`Lloc ${d.places.length + 1}`, names),
        floors: [seedFloor('Planta 1')],
      }
      return { ...d, places: [...d.places, place], activePlaceId: place.id }
    })
    setActiveFloorIndex(0)
    setSelectedSeat(null)
  }, [apply])

  const removePlace = useCallback((placeId: string) => {
    apply((d) => {
      if (d.places.length <= 1) return d
      const places = d.places.filter((p) => p.id !== placeId)
      const activePlaceId = d.activePlaceId === placeId ? places[0].id : d.activePlaceId
      return { ...d, places, activePlaceId }
    })
    setActiveFloorIndex(0)
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

  const addFloor = useCallback(() => {
    let newIndex = 0
    apply((d) => {
      const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
      const place = d.places[pi]
      if (!place) return d
      const names = place.floors.map((f) => f.name)
      const floor = seedFloor(uniqueName(`Planta ${place.floors.length + 1}`, names))
      const floors = [...place.floors, floor]
      newIndex = floors.length - 1
      const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
      return { ...d, places }
    })
    setActiveFloorIndex(newIndex)
    setSelectedSeat(null)
  }, [apply])

  const removeFloor = useCallback((index: number) => {
    apply((d) => {
      const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
      const place = d.places[pi]
      if (!place || place.floors.length <= 1) return d
      const floors = place.floors.filter((_, i) => i !== index)
      const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
      return { ...d, places }
    })
    setActiveFloorIndex((cur) => Math.max(0, cur > index ? cur - 1 : cur === index ? cur - 1 : cur))
    setSelectedSeat(null)
  }, [apply])

  const duplicateFloor = useCallback((index: number) => {
    let newIndex = index
    apply((d) => {
      const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
      const place = d.places[pi]
      const source = place?.floors[index]
      if (!place || !source) return d
      const names = place.floors.map((f) => f.name)
      const copy = cloneFloor(source, uniqueName(`${source.name} (còpia)`, names))
      const floors = [...place.floors.slice(0, index + 1), copy, ...place.floors.slice(index + 1)]
      newIndex = index + 1
      const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
      return { ...d, places }
    })
    setActiveFloorIndex(newIndex)
    setSelectedSeat(null)
  }, [apply])

  const renameFloor = useCallback((index: number, name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    apply((d) => {
      const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
      const place = d.places[pi]
      if (!place || !place.floors[index]) return d
      const floors = place.floors.map((f, i) => (i === index ? { ...f, name: trimmed } : f))
      const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
      return { ...d, places }
    })
  }, [apply])

  const reorderFloor = useCallback((from: number, to: number) => {
    if (from === to) return
    apply((d) => {
      const pi = Math.max(0, d.places.findIndex((p) => p.id === d.activePlaceId))
      const place = d.places[pi]
      if (!place) return d
      const floors = [...place.floors]
      if (from < 0 || from >= floors.length || to < 0 || to >= floors.length) return d
      const [moved] = floors.splice(from, 1)
      floors.splice(to, 0, moved)
      const places = d.places.map((p, i) => (i === pi ? { ...p, floors } : p))
      return { ...d, places }
    })
    setActiveFloorIndex(to)
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
    void saveFloorPlan(current, isMockMode).then(() => {
      setSavedSignature(floorPlanSignature(current))
    })
  }, [isMockMode])

  const reset = useCallback(() => {
    void loadFloorPlan(isMockMode).then((stored) => {
      const next = stored ?? defaultFloorPlan()
      undoStack.current = []
      redoStack.current = []
      dataRef.current = next
      setData(next)
      setSavedSignature(floorPlanSignature(next))
      setActiveFloorIndex(0)
      setSelectedSeat(null)
      syncHistoryFlags()
    })
  }, [isMockMode, syncHistoryFlags])

  // Keep the live active floor reachable from callbacks that read it (seatAt).
  useEffect(() => {
    activeFloorRef.current = activeFloor
  }, [activeFloor])

  return {
    loaded,
    data,
    places: data.places,
    activePlace,
    activeFloor,
    activeFloorIndex: safeFloorIndex,
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
    rotateFloor,
    // agents
    assignAgent,
    removeSeat,
    // background
    changeBackground,
    changeBackgroundOpacity,
    // structure
    selectPlace,
    selectFloor,
    addPlace,
    removePlace,
    renamePlace,
    addFloor,
    removeFloor,
    duplicateFloor,
    renameFloor,
    reorderFloor,
    // history + persistence
    undo,
    redo,
    save,
    reset,
  }
}

export type FloorPlanController = ReturnType<typeof useFloorPlan>
