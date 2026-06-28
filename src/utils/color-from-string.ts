/**
 * Color OKLCH determinístic derivat d'un string. Mateix string → mateix color.
 *
 * Dues decisions clau:
 *
 *  1. Hash FNV-1a amb avalanche per caràcter. Un hash polinòmic simple (base 31)
 *     queda dominat pels primers caràcters, de manera que noms amb prefix comú
 *     ("Suport tècnic L2" vs "L3", "Atenció Client" vs "Premium") col·lapsen al
 *     mateix hue. Barrejant els bits a *cada* caràcter, qualsevol diferència —
 *     encara que sigui l'últim caràcter — es propaga a tot el hash i separa els
 *     colors. Clau quan els noms són paraules de diccionari amb arrels repetides.
 *
 *  2. El color es genera en OKLCH, no en HSL. HSL no és perceptualment uniforme:
 *     un repartiment uniforme del hue en graus fa que verds i vermells/liles
 *     ocupin franges perceptives enormes (s'hi acumulen molts noms) mentre que
 *     taronja, groc, cian i blau viuen en franges estretes. OKLCH SÍ és
 *     perceptualment uniforme, així que un hue uniforme 0–360° es percep
 *     uniforme — sense necessitat de corregir res manualment. A més manté la
 *     lluminositat constant de debò, així tots els colors tenen el mateix pes
 *     visual i el mateix contrast amb el blanc.
 *
 *  Lluminositat variable per hue. La L base és 0.72 (pes visual i contrast amb
 *  el blanc uniformes), però el GROC és intrínsecament un color clar: a L=0.72 el
 *  que hauria de ser groc surt mostassa/oliva fangós ("color caca"). Per tenir
 *  groc de debò, la L puja seguint una campana centrada al groc (~95°): els tons
 *  grocs s'aclareixen fins a ~0.86 i la resta del cercle es queda a 0.72. Això no
 *  trenca la uniformitat perceptual — el groc ÉS més clar, així que aclarir-lo
 *  encaixa amb com l'ull el percep.
 *
 *  Croma adaptat al hue. Un croma fix queda limitat pel hue més restrictiu (el
 *  cian, ~210°), cosa que apaga la resta innecessàriament. Cada hue agafa el
 *  CHROMA_FRACTION (85%) del màxim que pot tenir dins del gamut sRGB a la SEVA
 *  lluminositat: colors vius i coherents, sense retall (el 15% de marge l'evita).
 *  Els navegadors moderns resolen oklch() de forma nativa.
 *
 *  Franja exclosa estreta (100–115°): la vora superior del groc continua sent un
 *  oliva-llima terrós tot i la campana de lluminositat. El hue uniforme la salta
 *  (fractionToHue), conservant el groc central (~95°) i la resta del cercle.
 */

/** Lluminositat OKLCH base — pes visual i contrast amb el blanc constants. */
const OKLCH_L_BASE = 0.72
/** Pic de lluminositat al groc (els grocs són intrínsecament clars). */
const OKLCH_L_PEAK = 0.86
/** Centre de la campana de lluminositat (hue del groc), en graus. */
const HUE_L_CENTER = 95
/** Amplada (σ) de la campana de lluminositat, en graus. */
const HUE_L_SIGMA = 22
/** Fracció del croma màxim per hue. Més alt → més viu; >~0.9 trenca l'equilibri. */
const CHROMA_FRACTION = 0.85
/** Franja de hue exclosa (oliva-llima fangós), en graus. El groc central (~95°)
    queda fora i es conserva; només se salta la vora terrosa. */
const HUE_GAP_START = 100
const HUE_GAP_END = 115
const HUE_GAP_SIZE = HUE_GAP_END - HUE_GAP_START

/** Franja de hue (graus) que colorFromString MAI genera. Exposada per a eines
    d'inspecció (p. ex. marcar-la a una llegenda de distribució). */
export const EXCLUDED_HUE_RANGE: readonly [number, number] = [HUE_GAP_START, HUE_GAP_END]

/** Mapeja una fracció uniforme [0,1) a un hue sobre el cercle MENYS la franja
    exclosa: rang efectiu 360 − HUE_GAP_SIZE graus; els hues a partir de
    HUE_GAP_START es desplacen per saltar el forat. Repartiment uniforme. */
function fractionToHue(frac: number): number {
  const hue = frac * (360 - HUE_GAP_SIZE)
  return hue < HUE_GAP_START ? hue : hue + HUE_GAP_SIZE
}

/** Distància angular mínima entre dos hues (0–180°). */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Lluminositat OKLCH per a un hue: base + campana gaussiana cap al groc. */
function lightnessForHue(hueDeg: number): number {
  const d = hueDistance(hueDeg, HUE_L_CENTER)
  return OKLCH_L_BASE + (OKLCH_L_PEAK - OKLCH_L_BASE) * Math.exp(-(d * d) / (2 * HUE_L_SIGMA * HUE_L_SIGMA))
}

/* ── Croma màxim assolible per (L, hue) dins del gamut sRGB ──────────────────
   OKLCH a sRGB no té forma tancada per al límit de gamut, així que el trobem amb
   una cerca binària curta sobre la conversió OKLab→sRGB lineal (Björn Ottosson).
   Prou ràpid: ~18 iteracions de polinomis senzills per color. */

/** True si oklch(L, C, hueDeg) cau fora del gamut sRGB. */
function outOfGamut(L: number, C: number, hueDeg: number): boolean {
  const h = (hueDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  // OKLab → LMS (arrels cúbiques inverses)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  // LMS → sRGB lineal
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const eps = 0.001
  return r < -eps || r > 1 + eps || g < -eps || g > 1 + eps || bl < -eps || bl > 1 + eps
}

/** Croma màxim dins del gamut sRGB per a (L, hueDeg), via cerca binària. */
function maxChroma(L: number, hueDeg: number): number {
  let lo = 0
  let hi = 0.4 // sostre per sobre de qualsevol croma sRGB real
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (outOfGamut(L, mid, hueDeg)) hi = mid
    else lo = mid
  }
  return lo
}

/**
 * Color OKLCH per a un hue donat, amb la lluminositat i el croma adaptats de
 * colorFromString. Útil per pintar escales/llegendes de hue coherents amb els
 * colors generats.
 */
export function oklchForHue(hueDeg: number): string {
  const L = lightnessForHue(hueDeg)
  const chroma = maxChroma(L, hueDeg) * CHROMA_FRACTION
  return `oklch(${L.toFixed(3)} ${chroma.toFixed(3)} ${hueDeg.toFixed(1)})`
}

export function colorFromString(str: string): string {
  const s = String(str ?? '')
  // FNV-1a amb avalanche per caràcter: cada caràcter barreja tots els bits, així
  // els prefixos comuns no determinen el resultat (vegeu la nota de capçalera).
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) // FNV prime
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
  }
  // fmix32 final (avalanche addicional sobre el hash acumulat)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  // >>> 0 just abans de dividir garanteix una fracció uint32 a [0, 1).
  // Hue uniforme sobre el cercle perceptual OKLCH, saltant la franja exclosa.
  const hue = fractionToHue((h >>> 0) / 0x100000000)
  return oklchForHue(hue)
}
