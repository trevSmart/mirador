export const SPACE_ZOOM_MIN = 0.5
export const SPACE_ZOOM_MAX = 3
export const SPACE_ZOOM_DEFAULT = 1
/** Fine nudge for +/- buttons; slider is fully continuous. */
export const SPACE_ZOOM_STEP = 0.05
export const SPACE_ZOOM_KEY = 'mirador.space.zoom'

/** Human-readable zoom factor, e.g. 2.7 → "2,7x", 1 → "1x". */
export function formatSpaceZoom(zoom: number): string {
  const rounded = Math.round(zoom * 10) / 10
  return `${rounded.toLocaleString('ca-ES', { maximumFractionDigits: 1 })}x`
}

export function loadSpaceZoom(): number {
  try {
    const raw = localStorage.getItem(SPACE_ZOOM_KEY)
    if (raw) {
      const value = Number.parseFloat(raw)
      if (Number.isFinite(value)) {
        return Math.min(SPACE_ZOOM_MAX, Math.max(SPACE_ZOOM_MIN, value))
      }
    }
  } catch {
    /* ignore */
  }
  return SPACE_ZOOM_DEFAULT
}

function clampZoom(value: number): number {
  return Math.min(SPACE_ZOOM_MAX, Math.max(SPACE_ZOOM_MIN, value))
}

/** Ctrl/⌘ + wheel: negative deltaY zooms in, positive zooms out. */
export function adjustSpaceZoomFromWheel(zoom: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015)
  return clampZoom(Number((zoom * factor).toFixed(3)))
}
