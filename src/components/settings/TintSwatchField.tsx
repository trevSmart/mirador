import {
  buildSpaceCanvasWash,
  SPACE_CANVAS_TINT_LABELS,
  SPACE_CANVAS_TINTS,
  type SpaceCanvasTint,
} from '../../settings/space-canvas-wash'
import type { ResolvedTheme } from '../../settings/theme'

export function TintSwatchField({
  value,
  onChange,
  theme = 'light',
}: {
  value: SpaceCanvasTint
  onChange: (value: SpaceCanvasTint) => void
  /** Tema amb què es previsualitza el gradient — el que s'aplicarà en desar. */
  theme?: ResolvedTheme
}) {
  return (
    <div className="settings-tint-swatches" role="radiogroup" aria-label="To del fons de les sales">
      {SPACE_CANVAS_TINTS.map((tint) => {
        const label = SPACE_CANVAS_TINT_LABELS[tint]
        return (
          <button
            key={tint}
            type="button"
            role="radio"
            aria-checked={value === tint}
            aria-label={label}
            title={label}
            className={`settings-tint-swatch${tint === 'none' ? ' settings-tint-swatch--none' : ''}${value === tint ? ' is-active' : ''}`}
            style={tint === 'none' ? undefined : { background: buildSpaceCanvasWash(tint, theme) }}
            onClick={() => onChange(tint)}
          />
        )
      })}
    </div>
  )
}
