/* Floor canvas background wash — subtle dual-tone gradient behind room renders.
   Each preset pairs two hues (e.g. green → lilac); buildFloorCanvasWash() layers
   corner radials plus a linear blend so the shift reads without overpowering. */

export type FloorCanvasTint = 'blue' | 'teal' | 'neutral' | 'warm' | 'violet'

export const FLOOR_CANVAS_TINTS: FloorCanvasTint[] = ['blue', 'teal', 'neutral', 'warm', 'violet']

export const FLOOR_CANVAS_TINT_LABELS: Record<FloorCanvasTint, string> = {
  blue: 'Blau · cel',
  teal: 'Verd · aigua',
  neutral: 'Fred · sorra',
  warm: 'Àmbar · rosa',
  violet: 'Verd · lila',
}

/** primary → top-right corner; secondary → bottom-left corner */
const TINT_PAIRS: Record<FloorCanvasTint, { primary: string; secondary: string }> = {
  blue: { primary: '#0060a0', secondary: '#3dd4f0' },
  teal: { primary: '#1a7a5c', secondary: '#5ee0d0' },
  neutral: { primary: '#6b7d94', secondary: '#d4b896' },
  warm: { primary: '#d47838', secondary: '#e890a8' },
  violet: { primary: '#a070d8', secondary: '#2d8a62' },
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ]
}

function mixColors(a: string, b: string, t: number): [number, number, number] {
  const c1 = parseHex(a)
  const c2 = parseHex(b)
  if (!c1 || !c2) return c1 ?? c2 ?? [236, 238, 241]
  const [r1, g1, b1] = c1
  const [r2, g2, b2] = c2
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ]
}

function rgbString([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`
}

function lightenRgb(rgb: [number, number, number], whiteRatio: number): string {
  const [r, g, b] = rgb
  const t = Math.min(1, Math.max(0, whiteRatio))
  return rgbString([
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t),
  ])
}

function tintFrom(hex: string, whiteRatio: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#eceef1'
  return lightenRgb(rgb, whiteRatio)
}

function blendTint(a: string, b: string, blendT: number, whiteRatio: number): string {
  return lightenRgb(mixColors(a, b, blendT), whiteRatio)
}

/** Build the full --fv-canvas-wash value for a given dual-tone preset. */
export function buildFloorCanvasWash(tint: FloorCanvasTint): string {
  const { primary, secondary } = TINT_PAIRS[tint]
  const [r1, g1, b1] = parseHex(primary)!
  const [r2, g2, b2] = parseHex(secondary)!

  const baseStart = tintFrom(secondary, 0.83)
  const baseMid = blendTint(secondary, primary, 0.5, 0.86)
  const baseEnd = tintFrom(primary, 0.83)

  return [
    'radial-gradient(ellipse 120% 95% at 50% -8%, rgba(255, 255, 255, 0.12) 0%, transparent 58%)',
    `radial-gradient(ellipse 90% 80% at 12% 92%, rgba(${r2}, ${g2}, ${b2}, 0.1) 0%, transparent 56%)`,
    `radial-gradient(ellipse 85% 75% at 88% 18%, rgba(${r1}, ${g1}, ${b1}, 0.1) 0%, transparent 54%)`,
    `linear-gradient(155deg, ${baseStart} 0%, ${baseMid} 52%, ${baseEnd} 100%)`,
  ].join(', ')
}
