/**
 * Intrinsic CSS aspect-ratio of a 2D room. The grid is `cols × VIEW_CELL` wide
 * by `rows × VIEW_CELL` tall; the shared VIEW_CELL factor cancels, so the ratio
 * is just cols/rows. Returned as a CSS `aspect-ratio` string so the browser
 * derives height from the filled width — mirroring how `.fv3d-svg` sizes from
 * its viewBox ratio.
 */
export function roomAspect(cols: number, rows: number): string {
  const w = cols > 0 ? cols : 1
  const h = rows > 0 ? rows : 1
  return `${w} / ${h}`
}
