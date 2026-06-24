import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { ButtonIcon } from '../ds/ButtonIcon'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'

export const FLOOR_ZOOM_MIN = 0.5
export const FLOOR_ZOOM_MAX = 2
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

interface FloorZoomSliderProps {
  zoom: number
  onChange: (zoom: number) => void
}

function FloorZoomSlider({ zoom, onChange }: FloorZoomSliderProps) {
  const pct = Math.round(zoom * 100)

  return (
    <div className="fv-zoom" role="group" aria-label="Zoom del plànol">
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Redueix el zoom"
        icon="utility:dash"
        size={14}
        disabled={zoom <= FLOOR_ZOOM_MIN}
        onClick={() => onChange(clampZoom(Number((zoom - FLOOR_ZOOM_STEP).toFixed(3))))}
      />
      <label className="fv-zoom__slider">
        <input
          type="range"
          aria-label="Zoom"
          aria-valuemin={FLOOR_ZOOM_MIN * 100}
          aria-valuemax={FLOOR_ZOOM_MAX * 100}
          aria-valuenow={pct}
          min={FLOOR_ZOOM_MIN * 100}
          max={FLOOR_ZOOM_MAX * 100}
          step={0.1}
          value={zoom * 100}
          onChange={(e) => onChange(clampZoom(Number(e.target.value) / 100))}
        />
      </label>
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Augmenta el zoom"
        icon="utility:add"
        size={14}
        disabled={zoom >= FLOOR_ZOOM_MAX}
        onClick={() => onChange(clampZoom(Number((zoom + FLOOR_ZOOM_STEP).toFixed(3))))}
      />
      <span className="fv-zoom__value" aria-hidden="true">
        {pct}%
      </span>
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Restableix el zoom al 100%"
        title="100%"
        icon="utility:refresh"
        size={14}
        disabled={pct === 100}
        onClick={() => onChange(FLOOR_ZOOM_DEFAULT)}
      />
    </div>
  )
}

interface FloorZoomControlProps {
  zoom: number
  onChange: (zoom: number) => void
}

export function FloorZoomControl({ zoom, onChange }: FloorZoomControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pct = Math.round(zoom * 100)

  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div className="fv-zoom-drop" ref={rootRef}>
      <button
        type="button"
        className="fv-zoom-drop__trigger fv-select"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Zoom del plànol (${pct}%)`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
      >
        <span className="fv-zoom-drop__label">Zoom</span>
        <span className="fv-zoom-drop__value">{pct}%</span>
        <span className="fv-zoom-drop__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div ref={dropRef} className="fv-zoom-drop__panel dropdown-panel" role="dialog" hidden>
        <FloorZoomSlider zoom={zoom} onChange={onChange} />
      </div>
    </div>
  )
}
