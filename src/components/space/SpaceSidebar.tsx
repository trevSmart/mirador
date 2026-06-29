import { useCallback, useRef, useState } from 'react'
import type { Place } from '../../space/types'
import { ButtonIcon } from '../ds/ButtonIcon'

// Font Awesome "clone" (regular), viewBox 0 0 640 640.
const CLONE_ICON_PATH =
  'M352 528L128 528C119.2 528 112 520.8 112 512L112 288C112 279.2 119.2 272 128 272L176 272L176 224L128 224C92.7 224 64 252.7 64 288L64 512C64 547.3 92.7 576 128 576L352 576C387.3 576 416 547.3 416 512L416 464L368 464L368 512C368 520.8 360.8 528 352 528zM288 368C279.2 368 272 360.8 272 352L272 128C272 119.2 279.2 112 288 112L512 112C520.8 112 528 119.2 528 128L528 352C528 360.8 520.8 368 512 368L288 368zM224 352C224 387.3 252.7 416 288 416L512 416C547.3 416 576 387.3 576 352L576 128C576 92.7 547.3 64 512 64L288 64C252.7 64 224 92.7 224 128L224 352z'

interface EditableLabelProps {
  value: string
  className?: string
  onCommit: (next: string) => void
}

function EditableLabel({ value, className, onCommit }: EditableLabelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Enter commits then unmounts the input, which fires onBlur and would commit
  // a second time. This guard makes the rename idempotent per edit session.
  const committedRef = useRef(false)

  if (editing) {
    return (
      <input
        autoFocus
        className="fe-rename"
        value={draft}
        maxLength={40}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!committedRef.current) onCommit(draft)
          committedRef.current = false
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            committedRef.current = true
            onCommit(draft)
            setEditing(false)
          } else if (e.key === 'Escape') {
            committedRef.current = true
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

interface SpaceSidebarProps {
  places: Place[]
  activePlace: Place | null
  activeSpaceIndex: number
  onSelectPlace: (id: string) => void
  onAddPlace: () => void
  onRemovePlace: (id: string) => void
  onRenamePlace: (id: string, name: string) => void
  onSelectSpace: (placeId: string, index: number) => void
  onAddSpace: (placeId: string) => void
  onRemoveSpace: (placeId: string, index: number) => void
  onDuplicateSpace: (placeId: string, index: number) => void
  onRenameSpace: (placeId: string, index: number, name: string) => void
  onReorderSpace: (placeId: string, from: number, to: number) => void
  onExport: () => void
  onImport: () => void
}

export function SpaceSidebar({
  places,
  activePlace,
  activeSpaceIndex,
  onSelectPlace,
  onAddPlace,
  onRemovePlace,
  onRenamePlace,
  onSelectSpace,
  onAddSpace,
  onRemoveSpace,
  onDuplicateSpace,
  onRenameSpace,
  onReorderSpace,
  onExport,
  onImport,
}: SpaceSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (activePlace?.id) initial.add(activePlace.id)
    return initial
  })
  const [dragState, setDragState] = useState<{ placeId: string; index: number } | null>(null)
  const [dropState, setDropState] = useState<{ placeId: string; index: number } | null>(null)

  const expandPlace = useCallback((placeId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(placeId)) return prev
      const next = new Set(prev)
      next.add(placeId)
      return next
    })
  }, [])

  const toggleExpand = useCallback((placeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(placeId)) next.delete(placeId)
      else next.add(placeId)
      return next
    })
  }, [])


  const handleSelectPlace = (placeId: string) => {
    expandPlace(placeId)
    onSelectPlace(placeId)
  }

  return (
    <div className="fe-sidebar">
      <section className="fe-section">
        <div className="fe-tree-panel">
          <header className="fe-tree-panel__head">
            <h3 className="fe-section__title">Llocs i plantes</h3>
            <button
              type="button"
              className="fe-add-btn"
              onClick={onImport}
              title="Importa llocs des d'un fitxer JSON"
            >
              Importa
            </button>
            <button
              type="button"
              className="fe-add-btn"
              onClick={onExport}
              disabled={places.length === 0}
              title="Exporta tots els llocs a JSON"
            >
              Exporta
            </button>
            <button type="button" className="fe-add-btn" onClick={onAddPlace} title="Afegeix un lloc">
              + Lloc
            </button>
          </header>

          <div className="fe-tree" role="tree" aria-label="Llocs i plantes">
          {places.map((place) => {
            const isExpanded = expandedIds.has(place.id)
            const isActivePlace = place.id === activePlace?.id

            return (
              <div key={place.id} role="none">
                <div
                  role="treeitem"
                  aria-level={1}
                  aria-expanded={isExpanded}
                  className={[
                    'fe-tree__place',
                    isExpanded ? 'fe-tree__place--expanded' : '',
                    isActivePlace ? 'fe-tree__place--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelectPlace(place.id)}
                >
                  <button
                    type="button"
                    className="fe-tree__chevron"
                    aria-label={isExpanded ? 'Replega' : 'Desplega'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(place.id)
                    }}
                  >
                    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
                      <path
                        d="M4 2l4 4-4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <EditableLabel
                    className="fe-place__name"
                    value={place.name}
                    onCommit={(name) => onRenamePlace(place.id, name)}
                  />
                  <span className="fe-place__count">{place.spaces.length}</span>
                  <button
                    type="button"
                    className="fe-add-btn fe-add-btn--inline"
                    title="Afegeix una planta"
                    onClick={(e) => {
                      e.stopPropagation()
                      expandPlace(place.id)
                      onAddSpace(place.id)
                    }}
                  >
                    + Planta
                  </button>
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

                {isExpanded ? (
                  <div className="fe-tree__children" role="group">
                    {place.spaces.map((space, index) => {
                      const isActiveSpace = isActivePlace && index === activeSpaceIndex
                      const isDropTarget =
                        dropState?.placeId === place.id &&
                        dropState.index === index &&
                        (dragState?.placeId !== place.id || dragState.index !== index)

                      return (
                        <div
                          key={space.id}
                          role="treeitem"
                          aria-level={2}
                          aria-selected={isActiveSpace}
                          className={[
                            'fe-space',
                            isActiveSpace ? 'fe-space--on' : '',
                            isDropTarget ? 'fe-space--drop' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          draggable
                          onDragStart={() => setDragState({ placeId: place.id, index })}
                          onDragOver={(e) => {
                            e.preventDefault()
                            if (dragState?.placeId === place.id) {
                              setDropState({ placeId: place.id, index })
                            }
                          }}
                          onDrop={() => {
                            if (
                              dragState?.placeId === place.id &&
                              dragState.index !== index
                            ) {
                              onReorderSpace(place.id, dragState.index, index)
                            }
                            setDragState(null)
                            setDropState(null)
                          }}
                          onDragEnd={() => {
                            setDragState(null)
                            setDropState(null)
                          }}
                          onClick={() => onSelectSpace(place.id, index)}
                        >
                          <span className="fe-space__grip" aria-hidden="true">
                            ⠿
                          </span>
                          <div className="fe-space__body">
                            <EditableLabel
                              className="fe-space__name"
                              value={space.name}
                              onCommit={(name) => onRenameSpace(place.id, index, name)}
                            />
                            <span className="fe-space__meta">
                              {space.seats.length} llocs de treball ·{' '}
                              {space.seats.filter((s) => s.agentId).length} agents
                            </span>
                          </div>
                          <ButtonIcon
                            className="fe-mini-btn"
                            title="Clona la planta"
                            aria-label="Clona la planta"
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation()
                              onDuplicateSpace(place.id, index)
                            }}
                          >
                            <svg width={14} height={14} viewBox="0 0 640 640" aria-hidden="true" fill="currentColor">
                              <path d={CLONE_ICON_PATH} />
                            </svg>
                          </ButtonIcon>
                          <button
                            type="button"
                            className="fe-mini-btn"
                            title="Elimina la planta"
                            disabled={place.spaces.length <= 1}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm(`Vols eliminar la planta "${space.name}"?`)) {
                                onRemoveSpace(place.id, index)
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        </div>
      </section>
    </div>
  )
}
