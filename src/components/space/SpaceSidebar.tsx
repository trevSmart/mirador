import { useCallback, useRef, useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Folder } from '../../space/types'
import { ActionMenu, type ActionMenuItem } from '../ds/ActionMenu'
import { AppIcon } from '../ds/AppIcon'
import type { AppIconName } from '../ds/app-icon-names.generated'
import { SfIcon } from '../ds/SfIcon'
import { SpacePlanThumb } from './SpacePlanThumb'
import { fileToLogoDataUrl } from '../../space/site-logo'

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

const Chevron = () => <AppIcon name="chevronright" size={12} />

/** Drag payload: either a space within a folder, or a whole folder subtree. */
type DragState =
  | { type: 'space'; folderId: string; spaceId: string; index: number }
  | { type: 'folder'; id: string }
  | null

/** Everything a FolderNode needs, bundled so the recursive component stays
    module-level (avoids remounting inputs on every parent render). */
interface TreeCtx {
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  activeFolderId: string | null
  activeSpaceId: string | null
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  expandFolder: (id: string) => void
  dragState: DragState
  setDragState: (s: DragState) => void
  dropSpace: { folderId: string; index: number } | null
  setDropSpace: (s: { folderId: string; index: number } | null) => void
  dropFolderId: string | null
  setDropFolderId: (id: string | null) => void
  pickImage: (folderId: string) => void
  onSetFolderImage: (id: string, dataUrl: string | null) => void
  onSelectFolder: (id: string) => void
  onAddFolder: (parentId: string | null) => void
  onRemoveFolder: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onToggleFolderActive: (id: string) => void
  onMoveFolder: (id: string, parentId: string | null, index: number) => void
  onSelectSpace: (folderId: string, spaceId: string) => void
  onAddSpace: (folderId: string) => void
  onRemoveSpace: (folderId: string, spaceId: string) => void
  onDuplicateSpace: (folderId: string, spaceId: string) => void
  onRenameSpace: (folderId: string, spaceId: string, name: string) => void
  onToggleSpaceActive: (folderId: string, spaceId: string) => void
  onMoveSpace: (folderId: string, from: number, to: number) => void
  onMoveSpaceToFolder: (fromFolderId: string, spaceId: string, toFolderId: string, index: number) => void
  rootCount: number
}

/** Small monochrome glyph for a menu item. */
function menuIcon(name: AppIconName) {
  return <AppIcon name={name} size={16} />
}

function FolderNode({ folder, depth, ancestorInactive = false, ctx }: { folder: Folder; depth: number; ancestorInactive?: boolean; ctx: TreeCtx }) {
  const isExpanded = ctx.expandedIds.has(folder.id)
  const isActive = folder.id === ctx.activeFolderId
  const isFolderDropTarget = ctx.dropFolderId === folder.id && ctx.dragState?.type === 'folder' && ctx.dragState.id !== folder.id
  // Inactivity flows downhill: a node dims if it is inactive itself OR any
  // ancestor folder is. The per-node toggle still reflects the node's own flag.
  const inactive = ancestorInactive || !folder.active

  const folderActions: ActionMenuItem[] = [
    {
      key: 'image',
      label: 'Carrega una imatge',
      icon: menuIcon('image'),
      onSelect: () => ctx.pickImage(folder.id),
    },
    ...(folder.image
      ? [{
          key: 'clear-image',
          label: 'Treu la imatge',
          icon: menuIcon('clear'),
          onSelect: () => ctx.onSetFolderImage(folder.id, null),
        } satisfies ActionMenuItem]
      : []),
    {
      key: 'add-folder',
      label: 'Afegeix una subcarpeta',
      icon: menuIcon('open_folder'),
      onSelect: () => { ctx.expandFolder(folder.id); ctx.onAddFolder(folder.id) },
    },
    {
      key: 'add-space',
      label: 'Afegeix una planta',
      icon: menuIcon('space'),
      onSelect: () => { ctx.expandFolder(folder.id); ctx.onAddSpace(folder.id) },
    },
    {
      key: 'delete',
      label: 'Elimina la carpeta',
      icon: menuIcon('delete'),
      danger: true,
      disabled: depth === 1 && ctx.rootCount <= 1,
      onSelect: () => {
        if (window.confirm(`Vols eliminar la carpeta "${folder.name}"?`)) {
          ctx.onRemoveFolder(folder.id)
        }
      },
    },
  ]

  return (
    <div role="none">
      <div
        role="treeitem"
        aria-level={depth}
        aria-expanded={isExpanded}
        className={[
          'fe-tree__place',
          isExpanded ? 'fe-tree__place--expanded' : '',
          isActive ? 'fe-tree__place--active' : '',
          inactive ? 'is-inactive' : '',
          isFolderDropTarget ? 'fe-tree__place--drop' : '',
        ].filter(Boolean).join(' ')}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          ctx.setDragState({ type: 'folder', id: folder.id })
        }}
        onDragOver={(e) => {
          const drag = ctx.dragState
          // Accept another folder (reparent) or a space from a different folder.
          if (
            (drag?.type === 'folder' && drag.id !== folder.id) ||
            (drag?.type === 'space' && drag.folderId !== folder.id)
          ) {
            e.preventDefault()
            e.stopPropagation()
            ctx.setDropFolderId(folder.id)
          }
        }}
        onDrop={(e) => {
          const drag = ctx.dragState
          if (drag?.type === 'folder' && drag.id !== folder.id) {
            e.stopPropagation()
            // Drop a folder onto another folder → becomes its last child.
            ctx.onMoveFolder(drag.id, folder.id, folder.folders.length)
            ctx.expandFolder(folder.id)
          } else if (drag?.type === 'space' && drag.folderId !== folder.id) {
            e.stopPropagation()
            // Drop a space onto a folder → moves it in as the last space.
            ctx.onMoveSpaceToFolder(drag.folderId, drag.spaceId, folder.id, folder.spaces.length)
            ctx.expandFolder(folder.id)
          }
          ctx.setDragState(null)
          ctx.setDropFolderId(null)
        }}
        onDragEnd={() => {
          ctx.setDragState(null)
          ctx.setDropFolderId(null)
        }}
        onClick={() => { ctx.expandFolder(folder.id); ctx.onSelectFolder(folder.id) }}
      >
        <button
          type="button"
          className="fe-tree__chevron"
          aria-label={isExpanded ? 'Replega' : 'Desplega'}
          onClick={(e) => { e.stopPropagation(); ctx.toggleExpand(folder.id) }}
        >
          <Chevron />
        </button>
        {folder.image
          ? <img className="fe-site__logo" src={folder.image} alt="" width={20} height={20} />
          : <SfIcon sprite="standard" symbol="folder" sldsSize="x-small" />}
        <EditableLabel
          className="fe-place__name"
          value={folder.name}
          onCommit={(name) => ctx.onRenameFolder(folder.id, name)}
        />
        {folder.spaces.length > 0 ? <span className="fe-place__count">{folder.spaces.length}</span> : null}
        <button
          type="button"
          className="fe-mini-btn"
          aria-pressed={folder.active}
          title={folder.active ? 'Carpeta activa — clic per amagar-la a les vistes' : 'Carpeta inactiva — clic per mostrar-la'}
          onClick={(e) => { e.stopPropagation(); ctx.onToggleFolderActive(folder.id) }}
        >
          {folder.active ? '◉' : '○'}
        </button>
        <ActionMenu label="Accions de la carpeta" items={folderActions} />
      </div>

      {isExpanded ? (
        <div className="fe-tree__children" role="group">
          {folder.folders.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} ancestorInactive={inactive} ctx={ctx} />
          ))}
          {folder.spaces.map((space, index) => {
            const isActiveSpace = space.id === ctx.activeSpaceId
            const isDropTarget =
              ctx.dropSpace?.folderId === folder.id &&
              ctx.dropSpace.index === index &&
              !(ctx.dragState?.type === 'space' && ctx.dragState.folderId === folder.id && ctx.dragState.index === index)

            return (
              <div
                key={space.id}
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isActiveSpace}
                className={[
                  'fe-space',
                  isActiveSpace ? 'fe-space--on' : '',
                  isDropTarget ? 'fe-space--drop' : '',
                  inactive || !space.active ? 'is-inactive' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  ctx.setDragState({ type: 'space', folderId: folder.id, spaceId: space.id, index })
                }}
                onDragOver={(e) => {
                  // Accept a space drag from this or any other folder.
                  if (ctx.dragState?.type === 'space') {
                    e.preventDefault()
                    e.stopPropagation()
                    ctx.setDropSpace({ folderId: folder.id, index })
                  }
                }}
                onDrop={(e) => {
                  const drag = ctx.dragState
                  if (drag?.type === 'space') {
                    e.stopPropagation()
                    if (drag.folderId === folder.id) {
                      if (drag.index !== index) ctx.onMoveSpace(folder.id, drag.index, index)
                    } else {
                      // Cross-folder: drop it into this folder at this position.
                      ctx.onMoveSpaceToFolder(drag.folderId, drag.spaceId, folder.id, index)
                    }
                  }
                  ctx.setDragState(null)
                  ctx.setDropSpace(null)
                }}
                onDragEnd={() => {
                  ctx.setDragState(null)
                  ctx.setDropSpace(null)
                }}
                onClick={() => ctx.onSelectSpace(folder.id, space.id)}
              >
                <span className="fe-space__grip" aria-hidden="true">⠿</span>
                <SpacePlanThumb space={space} agentsById={ctx.agentsById} queuesById={ctx.queuesById} />
                <div className="fe-space__body">
                  <EditableLabel
                    className="fe-space__name"
                    value={space.name}
                    onCommit={(name) => ctx.onRenameSpace(folder.id, space.id, name)}
                  />
                  <span className="fe-space__meta">
                    {space.seats.length} llocs de treball ·{' '}
                    {space.seats.filter((s) => s.agentId).length} agents
                  </span>
                </div>
                <button
                  type="button"
                  className="fe-mini-btn"
                  aria-pressed={space.active}
                  title={space.active ? 'Planta activa — clic per amagar-la a les vistes' : 'Planta inactiva — clic per mostrar-la'}
                  onClick={(e) => { e.stopPropagation(); ctx.onToggleSpaceActive(folder.id, space.id) }}
                >
                  {space.active ? '◉' : '○'}
                </button>
                <ActionMenu
                  label="Accions de la planta"
                  items={[
                    {
                      key: 'duplicate',
                      label: 'Clona la planta',
                      icon: menuIcon('clone'),
                      onSelect: () => ctx.onDuplicateSpace(folder.id, space.id),
                    },
                    {
                      key: 'delete',
                      label: 'Elimina la planta',
                      icon: menuIcon('delete'),
                      danger: true,
                      onSelect: () => {
                        if (window.confirm(`Vols eliminar la planta "${space.name}"?`)) {
                          ctx.onRemoveSpace(folder.id, space.id)
                        }
                      },
                    },
                  ]}
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

interface SpaceSidebarProps {
  folders: Folder[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  activeFolderId: string | null
  activeSpaceId: string | null
  onSelectFolder: (id: string) => void
  onAddFolder: (parentId: string | null) => void
  onRemoveFolder: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onSetFolderImage: (id: string, dataUrl: string | null) => void
  onToggleFolderActive: (id: string) => void
  onMoveFolder: (id: string, parentId: string | null, index: number) => void
  logoError: string | null
  onLogoError: (msg: string) => void
  onSelectSpace: (folderId: string, spaceId: string) => void
  onAddSpace: (folderId: string) => void
  onRemoveSpace: (folderId: string, spaceId: string) => void
  onDuplicateSpace: (folderId: string, spaceId: string) => void
  onRenameSpace: (folderId: string, spaceId: string, name: string) => void
  onToggleSpaceActive: (folderId: string, spaceId: string) => void
  onMoveSpace: (folderId: string, from: number, to: number) => void
  onMoveSpaceToFolder: (fromFolderId: string, spaceId: string, toFolderId: string, index: number) => void
  onExport: () => void
  onImport: () => void
}

export function SpaceSidebar({
  folders,
  agentsById,
  queuesById,
  activeFolderId,
  activeSpaceId,
  onSelectFolder,
  onAddFolder,
  onRemoveFolder,
  onRenameFolder,
  onSetFolderImage,
  onToggleFolderActive,
  onMoveFolder,
  logoError,
  onLogoError,
  onSelectSpace,
  onAddSpace,
  onRemoveSpace,
  onDuplicateSpace,
  onRenameSpace,
  onToggleSpaceActive,
  onMoveSpace,
  onMoveSpaceToFolder,
  onExport,
  onImport,
}: SpaceSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const f of folders) initial.add(f.id) // roots open by default
    if (activeFolderId) initial.add(activeFolderId)
    return initial
  })
  const [dragState, setDragState] = useState<DragState>(null)
  const [dropSpace, setDropSpace] = useState<{ folderId: string; index: number } | null>(null)
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageTargetId, setImageTargetId] = useState<string | null>(null)

  const pickImage = (folderId: string) => {
    setImageTargetId(folderId)
    fileInputRef.current?.click()
  }

  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !imageTargetId) return
    try {
      const dataUrl = await fileToLogoDataUrl(file)
      onSetFolderImage(imageTargetId, dataUrl)
    } catch (err) {
      onLogoError(err instanceof Error ? err.message : 'Error en carregar la imatge')
    }
  }

  const expandFolder = useCallback((id: string) => {
    setExpandedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
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

  const ctx: TreeCtx = {
    agentsById,
    queuesById,
    activeFolderId,
    activeSpaceId,
    expandedIds,
    toggleExpand,
    expandFolder,
    dragState,
    setDragState,
    dropSpace,
    setDropSpace,
    dropFolderId,
    setDropFolderId,
    pickImage,
    onSetFolderImage,
    onSelectFolder,
    onAddFolder,
    onRemoveFolder,
    onRenameFolder,
    onToggleFolderActive,
    onMoveFolder,
    onSelectSpace,
    onAddSpace,
    onRemoveSpace,
    onDuplicateSpace,
    onRenameSpace,
    onToggleSpaceActive,
    onMoveSpace,
    onMoveSpaceToFolder,
    rootCount: folders.length,
  }

  return (
    <div className="fe-sidebar">
      <section className="fe-section">
        <div className="fe-tree-panel">
          <header className="fe-tree-panel__head">
            <h3 className="fe-section__title">Carpetes i plantes</h3>
            <button
              type="button"
              className="fe-add-btn"
              onClick={onImport}
              title="Importa carpetes des d'un fitxer JSON"
            >
              Importa
            </button>
            <button
              type="button"
              className="fe-add-btn"
              onClick={onExport}
              disabled={folders.length === 0}
              title="Exporta totes les carpetes a JSON"
            >
              Exporta
            </button>
            <button type="button" className="fe-add-btn" onClick={() => onAddFolder(null)} title="Afegeix una carpeta">
              + Carpeta
            </button>
          </header>

          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => void onImageFile(e)} />
          {logoError ? <p className="fe-tree__error" role="alert">{logoError}</p> : null}

          <div
            className="fe-tree"
            role="tree"
            aria-label="Carpetes i plantes"
            onDragOver={(e) => {
              // Dropping on empty tree space promotes a dragged folder to a root.
              if (dragState?.type === 'folder') {
                e.preventDefault()
                setDropFolderId(null)
              }
            }}
            onDrop={() => {
              if (dragState?.type === 'folder') {
                onMoveFolder(dragState.id, null, folders.length)
              }
              setDragState(null)
              setDropFolderId(null)
              setDropSpace(null)
            }}
          >
            {folders.map((folder) => (
              <FolderNode key={folder.id} folder={folder} depth={1} ctx={ctx} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
