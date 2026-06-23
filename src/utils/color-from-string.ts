/** Deterministic HSL color from a string (same string → same hue). */
export function colorFromString(str: string): string {
  let h = 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return `hsl(${h % 360} 62% 58%)`
}
