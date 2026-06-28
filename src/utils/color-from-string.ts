/**
 * Color HSL determinístic derivat d'un string. Mateix string → mateix color.
 * Només varia el to (hue); saturació i lluminositat són fixes dins la gamma de
 * la paleta SF, així tots els colors tenen el mateix pes visual i contrast amb
 * el blanc. (Alineat amb l'algoritme del projecte panorama.)
 */
export function colorFromString(str: string): string {
  let h = 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0 // hash enter no negatiu
  }
  return `hsl(${h % 360} 62% 58%)`
}
