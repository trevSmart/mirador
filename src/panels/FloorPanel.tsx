import { useEffect, useMemo, useState } from 'react'
import { useMiradorData } from '../api/mirador-data-context'
import type { Agent, PresenceStatus } from '../api/types'
import { FloorView } from '../components/floor/FloorView'
import { FloorView3D, type SeatStyle } from '../components/floor/FloorView3D'
import { RotateIcon } from '../components/floor/RotateIcon'
import { PanelShell } from '../components/PanelState'
import { Select } from '../components/ds/Select'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import type { Dir } from '../floor/floor-iso'
import { useFloorPlanData } from '../floor/useFloorPlanData'
import { usePreferences } from '../settings/preferences-context'
import { presenceLabel } from '../utils/format'

const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'away', 'offline']
const STATUS_DOT: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

const SEAT_STYLES: Array<{ value: SeatStyle; label: string }> = [
  { value: 'tower', label: 'Torre + avatar' },
  { value: 'avatar', label: 'Només avatar' },
  { value: 'cube', label: 'Cub per equip' },
]

type ViewMode = '2d' | '3d'
const SEAT_STYLE_KEY = 'mirador.floor.seatStyle'

function loadSeatStyle(): SeatStyle {
  try {
    const raw = localStorage.getItem(SEAT_STYLE_KEY)
    if (raw === 'avatar' || raw === 'cube' || raw === 'tower') return raw
  } catch {
    /* ignore */
  }
  return 'tower'
}

export function FloorPanel() {
  const { data, loaded } = useFloorPlanData()
  const { agents } = useMiradorData()
  const { openAgent } = useDetailDrawer()
  const { prefs } = usePreferences()
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [floorIndex, setFloorIndex] = useState(0)

  // The view follows the user's default (Settings → Aparença). Changing the
  // preference re-syncs the live view, even though Dockview keeps this panel
  // mounted — handled by adjusting state during render when the default changes.
  // A manual toggle here still wins until the default preference changes again.
  const [view, setView] = useState<ViewMode>(prefs.defaultFloorView)
  const [prevDefault, setPrevDefault] = useState<ViewMode>(prefs.defaultFloorView)
  if (prevDefault !== prefs.defaultFloorView) {
    setPrevDefault(prefs.defaultFloorView)
    setView(prefs.defaultFloorView)
  }

  const [seatStyle, setSeatStyle] = useState<SeatStyle>(loadSeatStyle)
  const [dir, setDir] = useState<Dir>(0)

  useEffect(() => {
    try {
      localStorage.setItem(SEAT_STYLE_KEY, seatStyle)
    } catch {
      /* ignore */
    }
  }, [seatStyle])

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
    openAgent(agent.id)
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
              <Select
                className="fv-select"
                ariaLabel="Lloc"
                value={activePlace.id}
                options={data.places.map((place) => ({ value: place.id, label: place.name }))}
                onChange={(id) => {
                  setPlaceId(id)
                  setFloorIndex(0)
                }}
              />
            ) : (
              <span className="fv-place-name">{activePlace.name}</span>
            )}

            {activePlace.floors.length > 1 ? (
              <Select
                className="fv-select"
                ariaLabel="Planta"
                value={safeFloorIndex}
                options={activePlace.floors.map((floor, index) => ({ value: index, label: floor.name }))}
                onChange={(index) => setFloorIndex(index)}
              />
            ) : (
              <span className="fv-floor-name">{activeFloor.name}</span>
            )}
          </div>

          <div className="fv-controls">
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

            {view === '3d' ? (
              <>
                <Select
                  className="fv-select"
                  ariaLabel="Estil de seient"
                  value={seatStyle}
                  options={SEAT_STYLES}
                  onChange={(s) => setSeatStyle(s)}
                />
                <div className="fv-rotate">
                  <button
                    type="button"
                    className="fv-icon-btn"
                    title="Gira a l'esquerra"
                    aria-label="Gira a l'esquerra"
                    onClick={() => setDir((d) => (((d + 3) % 4) as Dir))}
                  >
                    <RotateIcon direction="left" />
                  </button>
                  <button
                    type="button"
                    className="fv-icon-btn"
                    title="Gira a la dreta"
                    aria-label="Gira a la dreta"
                    onClick={() => setDir((d) => (((d + 1) % 4) as Dir))}
                  >
                    <RotateIcon direction="right" />
                  </button>
                </div>
              </>
            ) : null}

            <div className="fv-toggle" role="group" aria-label="Vista">
              <button
                type="button"
                className={`fv-toggle__btn${view === '2d' ? ' fv-toggle__btn--on' : ''}`}
                onClick={() => setView('2d')}
              >
                2D
              </button>
              <button
                type="button"
                className={`fv-toggle__btn${view === '3d' ? ' fv-toggle__btn--on' : ''}`}
                onClick={() => setView('3d')}
              >
                3D
              </button>
            </div>
          </div>
        </header>

        <div className="fv-canvas">
          {view === '3d' ? (
            <FloorView3D
              floor={activeFloor}
              agentsById={agentsById}
              dir={dir}
              seatStyle={seatStyle}
              showAvatars={prefs.showAvatars}
              animations={prefs.animations}
              onSelectAgent={handleSelectAgent}
            />
          ) : (
            <FloorView
              floor={activeFloor}
              agentsById={agentsById}
              showAvatars={prefs.showAvatars}
              animations={prefs.animations}
              onSelectAgent={handleSelectAgent}
            />
          )}
        </div>
      </div>
    </PanelShell>
  )
}
