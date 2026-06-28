/* Per-room (per-floor) perspective rotation for the 3D floor render, persisted
   in localStorage so each sala keeps its own azimuth/tilt across reloads. */

export interface RoomRotation {
  az: number
  tilt: number
}

const ROOM_AZ_DEFAULT = 45
const ROOM_TILT_DEFAULT = 0.5
// Kept strictly inside (0, 90) so both basis vectors point down-screen, which
// the depth ordering and back-wall logic in floor-iso-vec assume.
export const ROOM_AZ_MIN = 15
export const ROOM_AZ_MAX = 75
export const ROOM_TILT_MIN = 0.3
export const ROOM_TILT_MAX = 0.75

const STORAGE_KEY = 'mirador.floor-rotation.v1'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function defaultRotation(): RoomRotation {
  return { az: ROOM_AZ_DEFAULT, tilt: ROOM_TILT_DEFAULT }
}

function sanitizeRotation(raw: Partial<RoomRotation> | null | undefined): RoomRotation {
  const az = typeof raw?.az === 'number' && Number.isFinite(raw.az) ? raw.az : ROOM_AZ_DEFAULT
  const tilt = typeof raw?.tilt === 'number' && Number.isFinite(raw.tilt) ? raw.tilt : ROOM_TILT_DEFAULT
  return { az: clamp(az, ROOM_AZ_MIN, ROOM_AZ_MAX), tilt: clamp(tilt, ROOM_TILT_MIN, ROOM_TILT_MAX) }
}

/** Load the whole `{ [floorId]: {az, tilt} }` map, sanitized. */
function loadRoomRotations(): Record<string, RoomRotation> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<RoomRotation>>
    const out: Record<string, RoomRotation> = {}
    for (const [id, value] of Object.entries(parsed ?? {})) {
      if (value && typeof value === 'object') out[id] = sanitizeRotation(value)
    }
    return out
  } catch {
    return {}
  }
}

function saveRoomRotations(map: Record<string, RoomRotation>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Read a single floor's rotation (falls back to the default isometric pose). */
export function loadRoomRotation(floorId: string): RoomRotation {
  return loadRoomRotations()[floorId] ?? defaultRotation()
}

/** Persist a single floor's rotation without clobbering the other floors'
    entries — each `FloorView3D` instance owns only its own key. */
export function saveRoomRotation(floorId: string, rotation: RoomRotation): void {
  const map = loadRoomRotations()
  map[floorId] = sanitizeRotation(rotation)
  saveRoomRotations(map)
}
