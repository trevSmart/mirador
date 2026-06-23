import { useMemo, useState } from 'react'
import { useMiradorData } from '../api/MiradorDataProvider'
import type { Agent, PresenceStatus } from '../api/types'
import { FloorView } from '../components/floor/FloorView'
import { PanelShell } from '../components/PanelState'
import { useFloorPlanData } from '../floor/useFloorPlanData'
import { presenceLabel } from '../utils/format'
import { recordDetailOpen } from '../utils/detail-recent-store'

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

export function FloorPanel() {
  const { data, loaded } = useFloorPlanData()
  const { agents } = useMiradorData()
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [floorIndex, setFloorIndex] = useState(0)

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])

  const activePlace = useMemo(() => {
    if (!data || data.places.length === 0) return null
    return data.places.find((p) => p.id === placeId) ?? data.places[0]
  }, [data, placeId])

  const safeFloorIndex = activePlace
    ? Math.min(Math.max(0, floorIndex), activePlace.floors.length - 1)
    : 0
  const activeFloor = activePlace?.floors[safeFloorIndex] ?? null

  const summary = useMemo(() => {
    const counts: Record<PresenceStatus, number> = { online: 0, busy: 0, away: 0, offline: 0 }
    let vacant = 0
    for (const seat of activeFloor?.seats ?? []) {
      const agent = seat.agentId ? agentsById.get(seat.agentId) : null
      if (agent) counts[agent.status] += 1
      else vacant += 1
    }
    return { counts, vacant, total: activeFloor?.seats.length ?? 0 }
  }, [activeFloor, agentsById])

  const handleSelectAgent = (agent: Agent) => {
    recordDetailOpen({ kind: 'agent', id: agent.id, name: agent.name })
    if (agent.recordUrl) window.open(agent.recordUrl, '_blank', 'noopener,noreferrer')
  }

  if (!loaded) {
    return (
      <PanelShell hideHeader className="panel-shell--floor">
        <p className="panel-state panel-state--muted">Carregant plànol…</p>
      </PanelShell>
    )
  }

  if (!data || !activePlace || !activeFloor) {
    return (
      <PanelShell hideHeader className="panel-shell--floor">
        <p className="panel-state panel-state--muted">
          Encara no hi ha cap plànol desat. Crea'l des del panell <strong>Floor editor</strong>.
        </p>
      </PanelShell>
    )
  }

  return (
    <PanelShell hideHeader className="panel-shell--floor">
      <div className="floor-view">
        <header className="fv-bar">
          <div className="fv-selectors">
            {data.places.length > 1 ? (
              <select
                className="fv-select"
                value={activePlace.id}
                onChange={(e) => {
                  setPlaceId(e.target.value)
                  setFloorIndex(0)
                }}
                aria-label="Lloc"
              >
                {data.places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="fv-place-name">{activePlace.name}</span>
            )}

            {activePlace.floors.length > 1 ? (
              <select
                className="fv-select"
                value={safeFloorIndex}
                onChange={(e) => setFloorIndex(Number(e.target.value))}
                aria-label="Planta"
              >
                {activePlace.floors.map((floor, index) => (
                  <option key={floor.id} value={index}>
                    {floor.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="fv-floor-name">{activeFloor.name}</span>
            )}
          </div>

          <div className="fv-summary">
            {STATUS_ORDER.map((status) => (
              <span key={status} className="fv-stat" title={presenceLabel(status)}>
                <span className="fv-stat__dot" style={{ background: STATUS_DOT[status] }} />
                {summary.counts[status]}
              </span>
            ))}
            <span className="fv-stat fv-stat--vacant" title="Seients lliures">
              {summary.vacant} lliures
            </span>
          </div>
        </header>

        <div className="fv-canvas">
          <FloorView floor={activeFloor} agentsById={agentsById} onSelectAgent={handleSelectAgent} />
        </div>
      </div>
    </PanelShell>
  )
}
