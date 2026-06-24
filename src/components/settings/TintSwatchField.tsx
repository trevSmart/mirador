import {
  buildFloorCanvasWash,
  FLOOR_CANVAS_TINT_LABELS,
  FLOOR_CANVAS_TINTS,
  type FloorCanvasTint,
} from '../../settings/floor-canvas-wash'

export function TintSwatchField({
  value,
  onChange,
}: {
  value: FloorCanvasTint
  onChange: (value: FloorCanvasTint) => void
}) {
  return (
    <div className="settings-tint-swatches" role="radiogroup" aria-label="To del fons de les sales">
      {FLOOR_CANVAS_TINTS.map((tint) => {
        const label = FLOOR_CANVAS_TINT_LABELS[tint]
        return (
          <button
            key={tint}
            type="button"
            role="radio"
            aria-checked={value === tint}
            aria-label={label}
            title={label}
            className={`settings-tint-swatch${tint === 'none' ? ' settings-tint-swatch--none' : ''}${value === tint ? ' is-active' : ''}`}
            style={tint === 'none' ? undefined : { background: buildFloorCanvasWash(tint) }}
            onClick={() => onChange(tint)}
          />
        )
      })}
    </div>
  )
}
