/* Space editor / viewer — shared 2D grid geometry.
   Both the editable grid and the read-only supervision view lay cells, seats and
   edges out the same way, just at different scales. Keeping the maths here means
   the two stay pixel-consistent. */

import type { Edge } from './types'

/** Default cell side in px for the editor grid. */
export const CELL_SIZE = 36
/** Thickness of an opening/divider bar in px. */
const EDGE_THICKNESS = 6

export interface EdgeRect {
  left: number
  top: number
  width: number
  height: number
}

/** Absolute position/size of the bar drawn for an edge, at a given cell size. */
export function edgeStyle(c: number, r: number, edge: Edge, cellSize: number = CELL_SIZE): EdgeRect {
  const horizontal = edge === 'N' || edge === 'S'
  if (horizontal) {
    return {
      left: c * cellSize,
      top: (edge === 'N' ? r : r + 1) * cellSize - EDGE_THICKNESS / 2,
      width: cellSize,
      height: EDGE_THICKNESS,
    }
  }
  return {
    left: (edge === 'E' ? c + 1 : c) * cellSize - EDGE_THICKNESS / 2,
    top: r * cellSize,
    width: EDGE_THICKNESS,
    height: cellSize,
  }
}
