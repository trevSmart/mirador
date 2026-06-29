import { useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Place } from '../../space/types'
import { SfIcon } from '../ds/SfIcon'
import { SpacePlanThumb } from './SpacePlanThumb'

interface SpacePlanTreeProps {
  places: Place[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

/* New, from-scratch replacement for the places/plants list. The hierarchy is a
   flat tree of labelled nodes; places with children expand/collapse with the
   grid-template-rows 1fr↔0fr animation used across apex-log-viewer. */
export function SpacePlanTree({ places, agentsById, queuesById }: SpacePlanTreeProps) {
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
      {places.map((place) => {
        const hasChildren = place.spaces.length > 0
        const expanded = hasChildren && !collapsedIds.has(place.id)

        return (
          <div
            key={place.id}
            className={`fe-plan-tree__place${expanded ? ' is-expanded' : ''}`}
          >
            <button
              type="button"
              className="fe-plan-tree__chevron"
              aria-label={expanded ? 'Replega' : 'Desplega'}
              aria-expanded={expanded}
              disabled={!hasChildren}
              onClick={() => toggle(place.id)}
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
            <SfIcon sprite="standard" symbol="address" sldsSize="x-small" />
            <span className="fe-plan-tree__place-name">{place.name}</span>
            <div className="fe-plan-tree__collapse">
              <div className="fe-plan-tree__collapse-inner">
                <div className="fe-plan-tree__spaces">
                  {place.spaces.map((space) => (
                    <div key={space.id} className="fe-plan-tree__space">
                      <SpacePlanThumb space={space} agentsById={agentsById} queuesById={queuesById} />
                      <span className="fe-plan-tree__space-name">{space.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
