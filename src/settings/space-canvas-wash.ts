/* Space canvas background wash — subtle dual-tone gradient behind room renders.
   Each preset pairs two hues (e.g. green → lilac); buildSpaceCanvasWash() layers
   corner radials plus a linear blend so the shift reads without overpowering.
   The hue pairs are shared by both themes; only the base they are mixed toward
   changes (near-white in light, the dark canvas ink in dark). */

import type { ResolvedTheme } from './theme'

export type SpaceCanvasTint = 'none' | 'blue' | 'teal' | 'neutral' | 'warm' | 'violet'

export const SPACE_CANVAS_TINTS: SpaceCanvasTint[] = ['none', 'blue', 'teal', 'neutral', 'warm', 'violet']

export const SPACE_CANVAS_TINT_LABELS: Record<SpaceCanvasTint, string> = {
  none: 'Sense gradient',
  blue: 'Blau · cel',
  teal: 'Verd · aigua',
  neutral: 'Fred · sorra',
  warm: 'Àmbar · rosa',
  violet: 'Verd · lila',
}

/** No wash at all — the canvas shows through with no background. */
const NO_CANVAS_FILL = 'transparent'

/** primary → top-right corner; secondary → bottom-left corner */
const TINT_PAIRS: Record<Exclude<SpaceCanvasTint, 'none'>, { primary: string; secondary: string }> = {
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

/** Base each hue is mixed toward: near-white paper (light) / canvas ink (dark). */
const WASH_BASE: Record<ResolvedTheme, [number, number, number]> = {
  light: [255, 255, 255],
  dark: [20, 19, 25], // #141319 — keep in sync with --mi-bg dark in index.css
}

function towardBase(rgb: [number, number, number], base: [number, number, number], ratio: number): string {
  const [r, g, b] = rgb
  const [br, bg, bb] = base
  const t = Math.min(1, Math.max(0, ratio))
  return rgbString([
    Math.round(r + (br - r) * t),
    Math.round(g + (bg - g) * t),
    Math.round(b + (bb - b) * t),
  ])
}

function tintFrom(hex: string, base: [number, number, number], ratio: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#eceef1'
  return towardBase(rgb, base, ratio)
}

function blendTint(a: string, b: string, blendT: number, base: [number, number, number], ratio: number): string {
  return towardBase(mixColors(a, b, blendT), base, ratio)
}

/** Build the full --fv-canvas-wash value for a given dual-tone preset. */
export function buildSpaceCanvasWash(tint: SpaceCanvasTint, theme: ResolvedTheme = 'light'): string {
  if (tint === 'none') return NO_CANVAS_FILL
  const { primary, secondary } = TINT_PAIRS[tint]
  const [r1, g1, b1] = parseHex(primary)!
  const [r2, g2, b2] = parseHex(secondary)!

  const base = WASH_BASE[theme]
  const ratio = theme === 'dark' ? 0.8 : 0.83
  const midRatio = theme === 'dark' ? 0.84 : 0.86
  const sheenAlpha = theme === 'dark' ? 0.05 : 0.12

  const baseStart = tintFrom(secondary, base, ratio)
  const baseMid = blendTint(secondary, primary, 0.5, base, midRatio)
  const baseEnd = tintFrom(primary, base, ratio)

  return [
    `radial-gradient(ellipse 120% 95% at 50% -8%, rgba(255, 255, 255, ${sheenAlpha}) 0%, transparent 58%)`,
    `radial-gradient(ellipse 90% 80% at 12% 92%, rgba(${r2}, ${g2}, ${b2}, 0.1) 0%, transparent 56%)`,
    `radial-gradient(ellipse 85% 75% at 88% 18%, rgba(${r1}, ${g1}, ${b1}, 0.1) 0%, transparent 54%)`,
    `linear-gradient(155deg, ${baseStart} 0%, ${baseMid} 52%, ${baseEnd} 100%)`,
  ].join(', ')
}
