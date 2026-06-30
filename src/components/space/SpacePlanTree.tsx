import { useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Site } from '../../space/types'
import { SfIcon } from '../ds/SfIcon'
import { SpacePlanThumb } from './SpacePlanThumb'

interface SpacePlanTreeProps {
  sites: Site[]
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

/* New, from-scratch replacement for the sites/places/plants list. The hierarchy
   is a tree of labelled nodes (Site → Place → Space); nodes with children
   expand/collapse with the grid-template-rows 1fr↔0fr animation used across
   apex-log-viewer. A Site shows its logo when set, else a fallback icon. */
export function SpacePlanTree({ sites, agentsById, queuesById }: SpacePlanTreeProps) {
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
      {sites.map((site) => {
        const siteExpanded = !collapsedIds.has(site.id)

        return (
          <div
            key={site.id}
            className={`fe-plan-tree__site${siteExpanded ? ' is-expanded' : ''}`}
          >
            <button
              type="button"
              className="fe-plan-tree__chevron"
              aria-label={siteExpanded ? 'Replega' : 'Desplega'}
              aria-expanded={siteExpanded}
              disabled={site.places.length === 0}
              onClick={() => toggle(site.id)}
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
            {site.image ? (
              <img className="fe-plan-tree__logo" src={site.image} alt="" width={16} height={16} />
            ) : (
              <SfIcon sprite="standard" symbol="home" sldsSize="x-small" />
            )}
            <span className="fe-plan-tree__site-name">{site.name}</span>
            <div className="fe-plan-tree__collapse">
              <div className="fe-plan-tree__collapse-inner">
                {site.places.map((place) => {
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
