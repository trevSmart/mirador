export const FLOOR_ZOOM_MIN = 0.5
export const FLOOR_ZOOM_MAX = 3
export const FLOOR_ZOOM_DEFAULT = 1
/** Fine nudge for +/- buttons; slider is fully continuous. */
export const FLOOR_ZOOM_STEP = 0.05
export const FLOOR_ZOOM_KEY = 'mirador.floor.zoom'

export function loadFloorZoom(): number {
  try {
    const raw = localStorage.getItem(FLOOR_ZOOM_KEY)
    if (raw) {
      const value = Number.parseFloat(raw)
      if (Number.isFinite(value)) {
        return Math.min(FLOOR_ZOOM_MAX, Math.max(FLOOR_ZOOM_MIN, value))
      }
    }
  } catch {
    /* ignore */
  }
  return FLOOR_ZOOM_DEFAULT
}

function clampZoom(value: number): number {
  return Math.min(FLOOR_ZOOM_MAX, Math.max(FLOOR_ZOOM_MIN, value))
}

/** Ctrl/⌘ + wheel: negative deltaY zooms in, positive zooms out. */
export function adjustFloorZoomFromWheel(zoom: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015)
  return clampZoom(Number((zoom * factor).toFixed(3)))
}
