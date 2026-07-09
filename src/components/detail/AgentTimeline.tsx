import { useMemo } from 'react'
import { agentTimelineResource, useEntity } from '../../api/data-service'
import type { Agent, PresenceSegment, PresenceStatus, WorkSegment } from '../../api/types'
import { colorFromRecordId, textColorFromRecordId } from '../../utils/color-from-string'
import { formatMinutes } from '../../utils/format'
import { resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { hourTicks, hourWindow, msToPercent, segmentBox } from '../../utils/timeline-scale'
import { SfIcon } from '../ds'
import { EmptyHint } from './parts'

/** Presence category → band color, mirroring STATUS_COLOR in AgentDetail. */
const BAND_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

/** Local YYYY-MM-DD for "today", matching how the mock keys a day. */
function todayISO(nowMs: number): string {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Local midnight (epoch ms) of a YYYY-MM-DD day. */
function startOfDayMs(dayISO: string): number {
  const [y, m, d] = dayISO.split('-').map((n) => Number.parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime()
}

/** How many work lanes to show before collapsing the rest into a "+N" row.
    Real orgs can have dozens of still-open carry-over items; the day view stays
    legible by capping the stack. */
const MAX_WORK_LANES = 6

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function rangeTitle(start: string, end: string | null, openEndMs: number): string {
  const startMs = Date.parse(start)
  const endMs = end === null ? openEndMs : Date.parse(end)
  const dur = formatMinutes(Math.max(1, Math.round((endMs - startMs) / 60_000)))
  const suffix = end === null ? ' (en curs)' : ''
  return `${hhmm(startMs)} – ${hhmm(endMs)} · ${dur}${suffix}`
}

/** Collapse the many AgentWork rows a single work item accrues (each re-route or
    transfer is its own row) into one logical bar, keyed by the backing record.
    Falls back to the row id when there's no record id, so unrelated rows stay
    distinct. Merged span = earliest start; still open if any row is open, else
    latest close. */
function dedupeWork(work: WorkSegment[]): WorkSegment[] {
  const byKey = new Map<string, WorkSegment>()
  for (const w of work) {
    const key = w.recordId ?? w.id
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...w })
      continue
    }
    const start = Date.parse(w.start) < Date.parse(existing.start) ? w.start : existing.start
    let end: string | null
    if (existing.end === null || w.end === null) {
      end = null
    } else {
      end = Date.parse(w.end) > Date.parse(existing.end) ? w.end : existing.end
    }
    byKey.set(key, { ...existing, start, end })
  }
  return [...byKey.values()]
}

/** Greedy interval packing: place each work bar in the first lane whose last bar
    has already ended, so overlapping work stacks onto separate rows. */
function packWork(work: WorkSegment[], openEndMs: number): WorkSegment[][] {
  const sorted = [...work].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const lanes: { end: number; items: WorkSegment[] }[] = []
  for (const seg of sorted) {
    const startMs = Date.parse(seg.start)
    const endMs = seg.end === null ? openEndMs : Date.parse(seg.end)
    const lane = lanes.find((l) => l.end <= startMs)
    if (lane) {
      lane.items.push(seg)
      lane.end = endMs
    } else {
      lanes.push({ end: endMs, items: [seg] })
    }
  }
  return lanes.map((l) => l.items)
}

function TrackGrid({
  ticks,
  windowStart,
  windowEnd,
  nowPct,
}: {
  ticks: { ms: number; label: string }[]
  windowStart: number
  windowEnd: number
  nowPct: number | null
}) {
  return (
    <>
      {ticks.map((t) => (
        <span
          key={t.ms}
          className="dd-tl__grid"
          style={{ left: `${msToPercent(t.ms, windowStart, windowEnd)}%` }}
        />
      ))}
      {nowPct !== null ? (
        <span className="dd-tl__now" style={{ left: `${nowPct}%` }} />
      ) : null}
    </>
  )
}

export function AgentTimeline({ agent }: { agent: Agent }) {
  const nowMs = useMemo(() => Date.now(), [])
  const day = todayISO(nowMs)
  const query = useEntity(agentTimelineResource, { agentId: agent.id, day })
  const timeline = query.data

  const model = useMemo(() => {
    if (!timeline) return null
    const segments = [...timeline.presence, ...timeline.work]
    if (segments.length === 0) return null

    // This is a single-day view, so the axis is bounded to [dayStart, now] and
    // the lanes only carry work that actually *started today*. Items opened on
    // an earlier day but still open ("carry-over") are real, but as full-width
    // bars they drown out the day and add no temporal information — we collapse
    // them into a single summary line instead of one lane each.
    const dayStartMs = startOfDayMs(day)
    const deduped = dedupeWork(timeline.work)
    const todayWork = deduped.filter((w) => Date.parse(w.start) >= dayStartMs)
    // Distinct items opened before today that are STILL open: listed compactly
    // below the Gantt (as bars they'd just span the full width). Ones closed
    // earlier today are dropped — they're neither "today's work" nor ongoing.
    const carryoverItems = deduped
      .filter((w) => Date.parse(w.start) < dayStartMs && w.end === null)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

    const windowSegs = [...timeline.presence, ...todayWork]
    const nativeStarts = windowSegs
      .map((s) => Date.parse(s.start))
      .filter((ms) => ms >= dayStartMs)
    const minMs = nativeStarts.length ? Math.min(...nativeStarts) : dayStartMs
    const { start, end } = hourWindow(minMs, nowMs)

    const allLanes = packWork(todayWork, nowMs)
    const lanes = allLanes.slice(0, MAX_WORK_LANES)
    const overflow = allLanes
      .slice(MAX_WORK_LANES)
      .reduce((total, lane) => total + lane.length, 0)

    return {
      windowStart: start,
      windowEnd: end,
      ticks: hourTicks(start, end),
      lanes,
      overflow,
      carryoverItems,
      nowPct: msToPercent(nowMs, start, end),
    }
  }, [timeline, nowMs, day])

  if (query.isLoading) {
    return <p className="dd-empty">Carregant cronologia…</p>
  }
  if (!timeline || !model) {
    return <EmptyHint>Sense activitat registrada avui.</EmptyHint>
  }

  const { windowStart, windowEnd, ticks, lanes, overflow, carryoverItems, nowPct } = model

  return (
    <div className="dd-tl">
      <div className="dd-tl__axis">
        <span className="dd-tl__gutter" />
        <div className="dd-tl__track dd-tl__track--axis">
          {ticks.map((t) => (
            <span
              key={t.ms}
              className="dd-tl__tick"
              style={{ left: `${msToPercent(t.ms, windowStart, windowEnd)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="dd-tl__lane">
        <span className="dd-tl__gutter">Presència</span>
        <div className="dd-tl__track">
          <TrackGrid ticks={ticks} windowStart={windowStart} windowEnd={windowEnd} nowPct={nowPct} />
          {timeline.presence.map((seg) => (
            <PresenceBand key={seg.id} seg={seg} windowStart={windowStart} windowEnd={windowEnd} nowMs={nowMs} />
          ))}
        </div>
      </div>

      {lanes.length === 0 ? (
        <div className="dd-tl__lane">
          <span className="dd-tl__gutter">Feina</span>
          <div className="dd-tl__track dd-tl__track--empty">
            <TrackGrid ticks={ticks} windowStart={windowStart} windowEnd={windowEnd} nowPct={nowPct} />
            <span className="dd-tl__none">Sense feina iniciada avui</span>
          </div>
        </div>
      ) : (
        lanes.map((laneItems, i) => (
          <div className="dd-tl__lane" key={i}>
            <span className="dd-tl__gutter">{i === 0 ? 'Feina' : ''}</span>
            <div className="dd-tl__track">
              <TrackGrid ticks={ticks} windowStart={windowStart} windowEnd={windowEnd} nowPct={nowPct} />
              {laneItems.map((seg) => (
                <WorkBar key={seg.id} seg={seg} windowStart={windowStart} windowEnd={windowEnd} nowMs={nowMs} />
              ))}
            </div>
          </div>
        ))
      )}

      {overflow > 0 ? (
        <div className="dd-tl__overflow">
          +{overflow} {overflow === 1 ? 'feina més' : 'feines més'} iniciades avui
        </div>
      ) : null}

      {carryoverItems.length > 0 ? (
        <div className="dd-tl__carry">
          <span className="dd-tl__carry-title">
            En curs des d&rsquo;abans d&rsquo;avui · {carryoverItems.length}
          </span>
          <div className="dd-tl__carry-list">
            {carryoverItems.map((seg) => {
              const icon = resolveWorkItemIcon({ channelKey: seg.channelKey })
              return (
                <span
                  className="dd-tl__carry-item"
                  key={seg.id}
                  title={seg.queue ? `${seg.label} · ${seg.queue}` : seg.label}
                >
                  <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={16} />
                  <span className="dd-tl__carry-label">{seg.label}</span>
                </span>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PresenceBand({
  seg,
  windowStart,
  windowEnd,
  nowMs,
}: {
  seg: PresenceSegment
  windowStart: number
  windowEnd: number
  nowMs: number
}) {
  const { left, width } = segmentBox(seg.start, seg.end, windowStart, windowEnd, nowMs)
  if (width <= 0) return null
  const band = BAND_COLOR[seg.status]
  return (
    <div
      className="dd-tl__band"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        background: `color-mix(in srgb, ${band} 24%, var(--surface-card))`,
        borderLeft: `3px solid ${band}`,
      }}
      title={`${seg.presenceLabel} · ${rangeTitle(seg.start, seg.end, nowMs)}`}
    >
      <span className="dd-tl__band-label">{seg.presenceLabel}</span>
    </div>
  )
}

function WorkBar({
  seg,
  windowStart,
  windowEnd,
  nowMs,
}: {
  seg: WorkSegment
  windowStart: number
  windowEnd: number
  nowMs: number
}) {
  const { left, width } = segmentBox(seg.start, seg.end, windowStart, windowEnd, nowMs)
  if (width <= 0) return null
  const icon = resolveWorkItemIcon({ channelKey: seg.channelKey })
  const tint = colorFromRecordId(seg.recordId ?? seg.id)
  const fg = textColorFromRecordId(seg.recordId ?? seg.id)
  return (
    <div
      className="dd-tl__bar"
      style={{ left: `${left}%`, width: `${width}%`, background: tint, color: fg }}
      data-ongoing={seg.end === null ? 'true' : 'false'}
      title={`${seg.label}${seg.queue ? ` · ${seg.queue}` : ''} · ${rangeTitle(seg.start, seg.end, nowMs)}`}
    >
      <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={16} />
      <span className="dd-tl__bar-label">{seg.label}</span>
    </div>
  )
}
