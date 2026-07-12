/* Shared axis scale for the wallboard bar charts. Gridlines sit at fixed
   even fractions (0/25/50/75/100%), so tick labels are only honest when the
   axis max is divisible by the segment count: the step is an integer and
   every label lands exactly on its gridline. */

export const AXIS_SEGMENTS = 4

/** Integer tick step covering `values`, nudged up to a multiple of 5 once
 *  steps grow past 5 so big axes keep round numbers (e.g. 0/30/60/90/120). */
function axisStep(values: number[], segments: number): number {
  const max = Math.max(1, ...values)
  const step = Math.ceil(max / segments)
  return step <= 5 ? step : Math.ceil(step / 5) * 5
}

/** Tick values from 0 to the axis max, one per gridline, ascending. */
export function axisTicks(values: number[], segments = AXIS_SEGMENTS): number[] {
  const step = axisStep(values, segments)
  return Array.from({ length: segments + 1 }, (_, i) => step * i)
}
