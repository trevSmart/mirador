import { describe, expect, it } from 'vitest'
import {
  colorFromRecordId,
  colorFromString,
  textColorFromRecordId,
  textColorFromString,
} from './color-from-string'
import { MOCK_QUEUE_ID_LIST } from '../api/mock/mock-ids'

function parseHue(color: string): number {
  const m = color.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

/** Bloc de família de color percebut per a un hue (mateixos talls que HUE_BLOCKS,
    amb llima+verd+cian agrupats com "verds"). */
function familyOf(hue: number): string {
  if (hue < 25 || hue >= 355) return 'vermell'
  if (hue < 70) return 'taronja'
  if (hue < 100) return 'groc'
  if (hue < 210) return 'verds'
  if (hue < 275) return 'blau'
  if (hue < 315) return 'lila'
  return 'rosa'
}

describe('colorFromRecordId', () => {
  it('spreads mock queue ids instead of clustering in green', () => {
    const hues = MOCK_QUEUE_ID_LIST.map((id) => parseHue(colorFromRecordId(id)))
    const greenCount = hues.filter((h) => h >= 115 && h < 170).length
    expect(greenCount).toBeLessThanOrEqual(2)
    expect(new Set(hues.map((h) => Math.floor(h / 30))).size).toBeGreaterThanOrEqual(4)
  })

  it('never emits a hue inside the excluded olive-lime band', () => {
    for (let i = 0; i < 2000; i++) {
      const hue = parseHue(colorFromString(`sample-${i}`))
      expect(hue < 100 || hue >= 115).toBe(true)
    }
  })

  it('balances perceived color families (green no longer dominates)', () => {
    // El remap perceptual ha de deixar cada família percebuda ~equiprobable. Sense
    // remap, "verds" (llima+verd+cian, ~95°) rebria ~27%; amb remap, cap família
    // supera el ~20%. Mostra gran i determinista → llindar estable.
    const counts: Record<string, number> = {}
    const N = 6000
    for (let i = 0; i < N; i++) {
      const fam = familyOf(parseHue(colorFromString(`entity-name-${i}`)))
      counts[fam] = (counts[fam] ?? 0) + 1
    }
    const greenShare = (counts.verds ?? 0) / N
    expect(greenShare).toBeLessThan(0.2)
    // cap família percebuda hauria de quedar per sota del ~8% (totes representades)
    for (const fam of ['vermell', 'taronja', 'groc', 'verds', 'blau', 'lila', 'rosa']) {
      expect((counts[fam] ?? 0) / N).toBeGreaterThan(0.08)
    }
  })

  it('is stable and folds Salesforce ids before hashing', () => {
    const id = '005mock0000000001AAA'
    expect(colorFromRecordId(id)).toBe(colorFromRecordId(id))
    expect(colorFromRecordId(id)).not.toBe(colorFromString(id))
  })

  it('returns foreground CSS variable for record ids', () => {
    expect(textColorFromRecordId('005mock0000000001AAA')).toMatch(/var\(--mi-av-fg-on-(dark|light)/)
  })
})

describe('textColorFromString', () => {
  it('returns a foreground CSS variable for display names', () => {
    expect(textColorFromString('Laura Pérez')).toMatch(/var\(--mi-av-fg-on-(dark|light)/)
    expect(textColorFromString('Núria Camps')).toMatch(/var\(--mi-av-fg-on-(dark|light)/)
  })
})
