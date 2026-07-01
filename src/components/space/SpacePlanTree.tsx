import { useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Folder } from '../../space/types'
import { SfIcon } from '../ds/SfIcon'
import { SpacePlanThumb } from './SpacePlanThumb'

interface SpacePlanTreeProps {
  folders: Folder[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

const Chevron = () => (
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
)

interface FolderNodeProps {
  folder: Folder
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
  collapsedIds: Set<string>
  toggle: (id: string) => void
}

function FolderNode({ folder, agentsById, queuesById, collapsedIds, toggle }: FolderNodeProps) {
  const hasChildren = folder.folders.length > 0 || folder.spaces.length > 0
  const expanded = hasChildren && !collapsedIds.has(folder.id)

  return (
    <div className={`fe-plan-tree__site${expanded ? ' is-expanded' : ''}${folder.active ? '' : ' is-inactive'}`}>
      <button
        type="button"
        className="fe-plan-tree__chevron"
        aria-label={expanded ? 'Replega' : 'Desplega'}
        aria-expanded={expanded}
        disabled={!hasChildren}
        onClick={() => toggle(folder.id)}
      >
        <Chevron />
      </button>
      {folder.image ? (
        <img className="fe-plan-tree__logo" src={folder.image} alt="" width={16} height={16} />
      ) : (
        <SfIcon sprite="standard" symbol="folder" sldsSize="x-small" />
      )}
      <span className="fe-plan-tree__site-name">{folder.name}</span>
      <div className="fe-plan-tree__collapse">
        <div className="fe-plan-tree__collapse-inner">
          {folder.folders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              agentsById={agentsById}
              queuesById={queuesById}
              collapsedIds={collapsedIds}
              toggle={toggle}
            />
          ))}
          {folder.spaces.length > 0 ? (
            <div className="fe-plan-tree__spaces">
              {folder.spaces.map((space) => (
                <div
                  key={space.id}
                  className={`fe-plan-tree__space${space.active ? '' : ' is-inactive'}`}
                >
                  <SpacePlanThumb space={space} agentsById={agentsById} queuesById={queuesById} />
                  <span className="fe-plan-tree__space-name">{space.name}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* Read-only preview of the folder tree shown under the editor. Folders nest
   arbitrarily; each shows its image when set, else a fallback icon. Nodes with
   children expand/collapse with the grid-template-rows 1fr↔0fr animation used
   across the app. */
export function SpacePlanTree({ folders, agentsById, queuesById }: SpacePlanTreeProps) {
  // Everything starts expanded; collapsing removes the id from the set.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fe-plan-tree">
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          agentsById={agentsById}
          queuesById={queuesById}
          collapsedIds={collapsedIds}
          toggle={toggle}
        />
      ))}
    </div>
  )
}
