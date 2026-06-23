import { useState } from 'react'
import { BACKGROUND_OPTIONS } from '../../floor/floor-plan-model'
import type { Floor, Place } from '../../floor/types'

interface EditableLabelProps {
  value: string
  className?: string
  onCommit: (next: string) => void
}

function EditableLabel({ value, className, onCommit }: EditableLabelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <input
        autoFocus
        className="fe-rename"
        value={draft}
        maxLength={40}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommit(draft)
            setEditing(false)
          } else if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className={className}
      title="Doble clic per reanomenar"
      onDoubleClick={(e) => {
        e.stopPropagation()
        setDraft(value)
        setEditing(true)
      }}
    >
      {value}
    </span>
  )
}

interface FloorSidebarProps {
  places: Place[]
  activePlace: Place | null
  activeFloorIndex: number
  activeFloor: Floor | null
  onSelectPlace: (id: string) => void
  onAddPlace: () => void
  onRemovePlace: (id: string) => void
  onRenamePlace: (id: string, name: string) => void
  onSelectFloor: (index: number) => void
  onAddFloor: () => void
  onRemoveFloor: (index: number) => void
  onDuplicateFloor: (index: number) => void
  onRenameFloor: (index: number, name: string) => void
  onReorderFloor: (from: number, to: number) => void
  onChangeBackground: (background: string | null) => void
  onChangeBackgroundOpacity: (opacity: number) => void
}

export function FloorSidebar({
  places,
  activePlace,
  activeFloorIndex,
  activeFloor,
  onSelectPlace,
  onAddPlace,
  onRemovePlace,
  onRenamePlace,
  onSelectFloor,
  onAddFloor,
  onRemoveFloor,
  onDuplicateFloor,
  onRenameFloor,
  onReorderFloor,
  onChangeBackground,
  onChangeBackgroundOpacity,
}: FloorSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const floors = activePlace?.floors ?? []

  return (
    <div className="fe-sidebar">
      {/* Places */}
      <section className="fe-section">
        <header className="fe-section__head">
          <h3 className="fe-section__title">Llocs</h3>
          <button type="button" className="fe-add-btn" onClick={onAddPlace} title="Afegeix un lloc">
            + Lloc
          </button>
        </header>
        <div className="fe-place-list">
          {places.map((place) => {
            const isActive = place.id === activePlace?.id
            return (
              <div
                key={place.id}
                className={`fe-place${isActive ? ' fe-place--on' : ''}`}
                onClick={() => onSelectPlace(place.id)}
              >
                <EditableLabel
                  className="fe-place__name"
                  value={place.name}
                  onCommit={(name) => onRenamePlace(place.id, name)}
                />
                <span className="fe-place__count">{place.floors.length}</span>
                <button
                  type="button"
                  className="fe-mini-btn"
                  title="Elimina el lloc"
                  disabled={places.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Vols eliminar el lloc "${place.name}"?`)) {
                      onRemovePlace(place.id)
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Floors */}
      <section className="fe-section">
        <header className="fe-section__head">
          <h3 className="fe-section__title">Plantes</h3>
          <button type="button" className="fe-add-btn" onClick={onAddFloor} title="Afegeix una planta">
            + Planta
          </button>
        </header>
        <div className="fe-floor-list">
          {floors.map((floor, index) => {
            const isActive = index === activeFloorIndex
            const isDropTarget = dropIndex === index && dragIndex !== index
            return (
              <div
                key={floor.id}
                className={[
                  'fe-floor',
                  isActive ? 'fe-floor--on' : '',
                  isDropTarget ? 'fe-floor--drop' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropIndex(index)
                }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) onReorderFloor(dragIndex, index)
                  setDragIndex(null)
                  setDropIndex(null)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDropIndex(null)
                }}
                onClick={() => onSelectFloor(index)}
              >
                <span className="fe-floor__grip" aria-hidden="true">
                  ⠿
                </span>
                <div className="fe-floor__body">
                  <EditableLabel
                    className="fe-floor__name"
                    value={floor.name}
                    onCommit={(name) => onRenameFloor(index, name)}
                  />
                  <span className="fe-floor__meta">
                    {floor.cells.length}▦ · {floor.seats.length}◍
                  </span>
                </div>
                <button
                  type="button"
                  className="fe-mini-btn"
                  title="Clona la planta"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicateFloor(index)
                  }}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="fe-mini-btn"
                  title="Elimina la planta"
                  disabled={floors.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Vols eliminar la planta "${floor.name}"?`)) {
                      onRemoveFloor(index)
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Background */}
      <section className="fe-section">
        <header className="fe-section__head">
          <h3 className="fe-section__title">Fons</h3>
        </header>
        <div className="fe-bg-options">
          <button
            type="button"
            className={`fe-bg-chip${!activeFloor?.background ? ' fe-bg-chip--on' : ''}`}
            disabled={!activeFloor}
            onClick={() => onChangeBackground(null)}
          >
            Cap
          </button>
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`fe-bg-chip${activeFloor?.background === option.id ? ' fe-bg-chip--on' : ''}`}
              disabled={!activeFloor}
              onClick={() => onChangeBackground(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="fe-opacity">
          <span>Opacitat</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((activeFloor?.backgroundOpacity ?? 0) * 100)}
            disabled={!activeFloor?.background}
            onChange={(e) => onChangeBackgroundOpacity(Number(e.target.value) / 100)}
          />
          <span className="fe-opacity__value">
            {Math.round((activeFloor?.backgroundOpacity ?? 0) * 100)}%
          </span>
        </label>
      </section>
    </div>
  )
}
