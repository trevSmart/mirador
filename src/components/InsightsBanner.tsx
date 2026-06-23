import type { HealthInsights, HealthPillar } from '../utils/health-insights'
import type { PanelType } from '../panels/registry'

interface InsightsBannerProps {
  health: HealthInsights
  queueCount: number
  onOpenPanel?: (panel: PanelType) => void
}

function pillarValueClass(value: HealthPillar['value']): string {
  return String(value).includes(' ') ? 'insights-pillar__value--long' : ''
}

export function InsightsBanner({ health, queueCount, onOpenPanel }: InsightsBannerProps) {
  return (
    <header className="insights-banner">
      <div className="insights-banner__verdict">
        <span className={`insights-banner__dot insights-banner__dot--${health.dot}`} aria-hidden="true" />
        <div>
          <h1 className="insights-banner__title">{health.title}</h1>
          <p className="insights-banner__subtitle">{health.subtitle}</p>
          <div className="insights-banner__meta">
            <span className="insights-banner__live">
              <i aria-hidden="true" />
              en directe
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <b className="pa-mono">{health.online}</b> agents online
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <b className="pa-mono">{queueCount}</b> cues actives
            </span>
            <span aria-hidden="true">·</span>
            <span>actualitzat ara mateix</span>
          </div>
        </div>
      </div>

      <div className="insights-banner__pillars">
        {health.pillars.map((pillar) => (
          <button
            key={pillar.id}
            type="button"
            className={`insights-pillar${pillar.state !== 'ok' ? ` insights-pillar--${pillar.state}` : ''}`}
            onClick={() => onOpenPanel?.(pillar.targetPanel)}
          >
            <span className="insights-pillar__arrow" aria-hidden="true">
              →
            </span>
            <div className={`insights-pillar__value ${pillarValueClass(pillar.value)}`.trim()}>
              {pillar.value}
            </div>
            <div className="insights-pillar__label">{pillar.label}</div>
            <div className="insights-pillar__status">
              <i style={{ background: `var(--status-${pillar.state})` }} aria-hidden="true" />
              <span>{pillar.statusMessage}</span>
            </div>
          </button>
        ))}
      </div>
    </header>
  )
}
