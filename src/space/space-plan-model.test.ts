import { describe, expect, it } from 'vitest'
import {
  SPACE_SCHEMA_VERSION,
  prepareImportedPlaces,
  uniqueName,
} from './space-plan-model'
import type { SpacePlanData } from './types'

/** A minimal valid plan: one place, one space with a single cell. */
function validPlan(placeName = 'Lloc A'): SpacePlanData {
  return {
    v: SPACE_SCHEMA_VERSION,
    activePlaceId: 'p1',
    places: [
      {
        id: 'p1',
        name: placeName,
        spaces: [
          { id: 's1', name: 'Planta 1', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0 },
        ],
      },
    ],
  }
}

describe('uniqueName', () => {
  it('returns the base name when there is no collision', () => {
    expect(uniqueName('Lloc', ['Altre'])).toBe('Lloc')
  })

  it('appends a numeric suffix on collision, skipping taken numbers', () => {
    expect(uniqueName('Lloc', ['Lloc'])).toBe('Lloc 2')
    expect(uniqueName('Lloc', ['Lloc', 'Lloc 2'])).toBe('Lloc 3')
  })
})

describe('prepareImportedPlaces', () => {
  it('rejects an incompatible schema version', () => {
    const plan = { ...validPlan(), v: 0 }
    expect(prepareImportedPlaces(plan, [])).toBeNull()
  })

  it('rejects non-plan input', () => {
    expect(prepareImportedPlaces(null, [])).toBeNull()
    expect(prepareImportedPlaces('nope', [])).toBeNull()
    expect(prepareImportedPlaces({ v: SPACE_SCHEMA_VERSION, places: [] }, [])).toBeNull()
  })

  it('regenerates ids so imported records never reuse the source ids', () => {
    const result = prepareImportedPlaces(validPlan(), [])
    expect(result).not.toBeNull()
    const [place] = result!
    expect(place.id).not.toBe('p1')
    expect(place.spaces[0].id).not.toBe('s1')
  })

  it('keeps the name when there is no collision', () => {
    const result = prepareImportedPlaces(validPlan('Lloc A'), ['Altre lloc'])
    expect(result![0].name).toBe('Lloc A')
  })

  it('suffixes the name only when it collides with an existing place', () => {
    const result = prepareImportedPlaces(validPlan('Lloc A'), ['Lloc A'])
    expect(result![0].name).toBe('Lloc A 2')
  })

  it('preserves the space geometry of the imported plan', () => {
    const result = prepareImportedPlaces(validPlan(), [])
    expect(result![0].spaces[0].cells).toEqual([[0, 0]])
  })
})
