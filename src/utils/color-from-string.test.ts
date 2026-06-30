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
  return m ? parseFloat(m[1]!) : 0
}

describe('colorFromRecordId', () => {
  it('spreads mock queue ids instead of clustering in green', () => {
    const hues = MOCK_QUEUE_ID_LIST.map((id) => parseHue(colorFromRecordId(id)))
    const greenCount = hues.filter((h) => h >= 115 && h < 170).length
    expect(greenCount).toBeLessThanOrEqual(2)
    expect(new Set(hues.map((h) => Math.floor(h / 30))).size).toBeGreaterThanOrEqual(4)
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
