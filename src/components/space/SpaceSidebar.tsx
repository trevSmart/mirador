import { useCallback, useRef, useState } from 'react'
import type { Place, Site } from '../../space/types'
import { ButtonIcon } from '../ds/ButtonIcon'
import { SfIcon } from '../ds/SfIcon'
import { fileToLogoDataUrl } from '../../space/site-logo'

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
  sites: Site[]
  activeSite: Site | null
  activePlace: Place | null
  activeSpaceIndex: number
  onSelectSite: (id: string) => void
  onAddSite: () => void
  onRemoveSite: (id: string) => void
  onRenameSite: (id: string, name: string) => void
  onSetSiteLogo: (id: string, dataUrl: string | null) => void
  logoError: string | null
  onLogoError: (msg: string) => void
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
  sites,
  activeSite,
  activePlace,
  activeSpaceIndex,
  onSelectSite,
  onAddSite,
  onRemoveSite,
  onRenameSite,
  onSetSiteLogo,
  logoError,
  onLogoError,
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
    if (activeSite?.id) initial.add(activeSite.id)
    if (activePlace?.id) initial.add(activePlace.id)
    return initial
  })
  const [dragState, setDragState] = useState<{ placeId: string; index: number } | null>(null)
  const [dropState, setDropState] = useState<{ placeId: string; index: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null)

  const pickLogo = (siteId: string) => {
    setLogoTargetId(siteId)
    fileInputRef.current?.click()
  }

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !logoTargetId) return
    try {
      const dataUrl = await fileToLogoDataUrl(file)
      onSetSiteLogo(logoTargetId, dataUrl)
    } catch (err) {
      onLogoError(err instanceof Error ? err.message : 'Error en carregar la imatge')
    }
  }

  const expandPlace = useCallback((placeId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(placeId)) return prev
      const next = new Set(prev)
      next.add(placeId)
      return next
    })
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectPlace = (placeId: string) => {
    expandPlace(placeId)
    onSelectPlace(placeId)
  }

  // The total count of places across all sites, used to determine when to
  // disable the Exporta button (mirrors old `places.length === 0` check).
  const totalPlaces = sites.reduce((acc, s) => acc + s.places.length, 0)

  return (
    <div className="fe-sidebar">
      <section className="fe-section">
        <div className="fe-tree-panel">
          <header className="fe-tree-panel__head">
            <h3 className="fe-section__title">Sites, llocs i plantes</h3>
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
              disabled={totalPlaces === 0}
              title="Exporta tots els llocs a JSON"
            >
              Exporta
            </button>
            <button type="button" className="fe-add-btn" onClick={onAddPlace} title="Afegeix un lloc">
              + Lloc
            </button>
            <button type="button" className="fe-add-btn" onClick={onAddSite} title="Afegeix un site">
              + Site
            </button>
          </header>

          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => void onLogoFile(e)} />
          {logoError ? <p className="fe-tree__error" role="alert">{logoError}</p> : null}

          <div className="fe-tree" role="tree" aria-label="Sites, llocs i plantes">
          {sites.map((site) => {
            const isSiteExpanded = expandedIds.has(site.id)
            const isActiveSite = site.id === activeSite?.id

            return (
              <div key={site.id} role="none">
                <div className="fe-tree__site" role="treeitem" aria-level={1}>
                  <button
                    type="button"
                    className="fe-tree__chevron"
                    aria-label={isSiteExpanded ? 'Replega' : 'Desplega'}
                    onClick={() => toggleExpand(site.id)}
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
                  {site.image
                    ? <img className="fe-site__logo" src={site.image} alt="" width={20} height={20} />
                    : <SfIcon sprite="standard" symbol="home" sldsSize="x-small" />}
                  <EditableLabel
                    className="fe-site__name"
                    value={site.name}
                    onCommit={(n) => onRenameSite(site.id, n)}
                  />
                  <button
                    type="button"
                    className="fe-add-btn fe-add-btn--inline"
                    onClick={() => pickLogo(site.id)}
                    title="Carrega un logo"
                  >
                    Logo
                  </button>
                  {site.image
                    ? (
                      <button
                        type="button"
                        className="fe-mini-btn"
                        title="Treu el logo"
                        onClick={() => onSetSiteLogo(site.id, null)}
                      >
                        ⌫
                      </button>
                    )
                    : null}
                  <button
                    type="button"
                    className="fe-add-btn fe-add-btn--inline"
                    onClick={() => { onSelectSite(site.id); onAddPlace() }}
                    title="Afegeix un lloc"
                  >
                    + Lloc
                  </button>
                  <button
                    type="button"
                    className="fe-mini-btn"
                    disabled={sites.length <= 1}
                    onClick={() => {
                      if (window.confirm(`Vols eliminar el site "${site.name}"?`)) {
                        onRemoveSite(site.id)
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>

                {isSiteExpanded ? (
                  <div className="fe-tree__children" role="group">
                    {site.places.map((place) => {
                      const isExpanded = expandedIds.has(place.id)
                      const isActivePlace = place.id === activePlace?.id && isActiveSite

                      return (
                        <div key={place.id} role="none">
                          <div
                            role="treeitem"
                            aria-level={2}
                            aria-expanded={isExpanded}
                            className={[
                              'fe-tree__place',
                              isExpanded ? 'fe-tree__place--expanded' : '',
                              isActivePlace ? 'fe-tree__place--active' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => { onSelectSite(site.id); handleSelectPlace(place.id) }}
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
                              disabled={site.places.length <= 1}
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
                                    aria-level={3}
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
