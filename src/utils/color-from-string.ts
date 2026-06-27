/**
 * Deterministic HSL color from a string (same string → same hue). Saturation
 * and lightness sit in a soft pastel band — gentle backgrounds that read well
 * behind dark text/initials.
 */
export function colorFromString(str: string): string {
  let h = 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  // Vary saturation/lightness slightly per-hue so adjacent colors stay distinct
  // while keeping the whole range in a soft (but not washed-out) pastel band.
  const sat = 58 + ((h >>> 8) % 14) // 58–71%
  const light = 62 + ((h >>> 16) % 8) // 62–69%
  return `hsl(${h % 360} ${sat}% ${light}%)`
}
