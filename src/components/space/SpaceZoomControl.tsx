import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { AppIcon } from '../ds/AppIcon'
import { ButtonIcon } from '../ds/ButtonIcon'
import { syncDropdownPanel } from '../../utils/sync-dropdown-panel'
import {
  SPACE_ZOOM_DEFAULT,
  SPACE_ZOOM_MAX,
  SPACE_ZOOM_MIN,
  SPACE_ZOOM_STEP,
  formatSpaceZoom,
} from './space-zoom'

interface SpaceZoomSliderProps {
  zoom: number
  onChange: (zoom: number) => void
  minZoom: number
  maxZoom: number
}

function SpaceZoomSlider({ zoom, onChange, minZoom, maxZoom }: SpaceZoomSliderProps) {
  const pct = Math.round(zoom * 100)
  const label = formatSpaceZoom(zoom)
  const clamp = (value: number) => Math.min(maxZoom, Math.max(minZoom, value))

  return (
    <div className="fv-zoom" role="group" aria-label="Zoom del plànol">
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Redueix el zoom"
        icon="dash"
        size={14}
        disabled={zoom <= minZoom}
        onClick={() => onChange(clamp(Number((zoom - SPACE_ZOOM_STEP).toFixed(3))))}
      />
      <label className="fv-zoom__slider">
        <input
          type="range"
          aria-label="Zoom"
          aria-valuemin={minZoom * 100}
          aria-valuemax={maxZoom * 100}
          aria-valuenow={pct}
          min={minZoom * 100}
          max={maxZoom * 100}
          step={0.1}
          value={zoom * 100}
          onChange={(e) => onChange(clamp(Number(e.target.value) / 100))}
        />
      </label>
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Augmenta el zoom"
        icon="add"
        size={14}
        disabled={zoom >= maxZoom}
        onClick={() => onChange(clamp(Number((zoom + SPACE_ZOOM_STEP).toFixed(3))))}
      />
      <span className="fv-zoom__value" aria-hidden="true">
        {label}
      </span>
      <ButtonIcon
        className="fv-icon-btn"
        aria-label="Restableix el zoom a 1x"
        title="1x"
        icon="refresh"
        size={14}
        disabled={pct === 100}
        onClick={() => onChange(SPACE_ZOOM_DEFAULT)}
      />
    </div>
  )
}

interface SpaceZoomControlProps {
  zoom: number
  onChange: (zoom: number) => void
  /** Overridable zoom bounds (default to the shared space-zoom constants). */
  minZoom?: number
  maxZoom?: number
}

export function SpaceZoomControl({ zoom, onChange, minZoom = SPACE_ZOOM_MIN, maxZoom = SPACE_ZOOM_MAX }: SpaceZoomControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const label = formatSpaceZoom(zoom)

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
        aria-label={`Zoom del plànol (${label})`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
      >
        <span className="fv-zoom-drop__label">Zoom</span>
        <span className="fv-zoom-drop__value">{label}</span>
        <AppIcon name="down" size={10} className="fv-zoom-drop__caret" />
      </button>
      <div ref={dropRef} className="fv-zoom-drop__panel dropdown-panel" role="dialog" hidden>
        <SpaceZoomSlider zoom={zoom} onChange={onChange} minZoom={minZoom} maxZoom={maxZoom} />
      </div>
    </div>
  )
}
