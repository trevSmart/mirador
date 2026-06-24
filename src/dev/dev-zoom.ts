/* EXPERIMENTAL — Dev tab only. Self-contained zoom helpers that mirror the
   official floor-zoom but allow up to 400% and persist under their own key, so
   the experiment never clamps or fights the official Floor zoom. Delete with
   `src/dev/`. */

export const DEV_ZOOM_MIN = 0.5
export const DEV_ZOOM_MAX = 4
export const DEV_ZOOM_DEFAULT = 1
export const DEV_ZOOM_STEP = 0.05
export const DEV_ZOOM_KEY = 'mirador.dev.floor.zoom'

export function clampDevZoom(value: number): number {
  return Math.min(DEV_ZOOM_MAX, Math.max(DEV_ZOOM_MIN, value))
}

export function loadDevZoom(): number {
  try {
    const raw = localStorage.getItem(DEV_ZOOM_KEY)
    if (raw) {
      const value = Number.parseFloat(raw)
      if (Number.isFinite(value)) return clampDevZoom(value)
    }
  } catch {
    /* ignore */
  }
  return DEV_ZOOM_DEFAULT
}

/** Ctrl/⌘ + wheel: negative deltaY zooms in, positive zooms out. */
export function adjustDevZoomFromWheel(zoom: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015)
  return clampDevZoom(Number((zoom * factor).toFixed(3)))
}
