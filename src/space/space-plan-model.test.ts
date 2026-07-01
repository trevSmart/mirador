import { describe, expect, it } from 'vitest'
import {
  SPACE_SCHEMA_VERSION,
  LEGACY_WIRE_SITE_ID,
  uniqueName,
  sanitizeImage,
  sanitizeSpacePlan,
  parseStoredSpacePlan,
  toWireSpacePlan,
  defaultSpacePlan,
  prepareImportedSites,
  visiblePlaces,
  visibleSpaces,
  seedFolder,
  MAX_FOLDER_DEPTH,
} from './space-plan-model'
import type { SpacePlanData, Place } from './types'

function validPlace(name = 'Lloc A'): Place {
  return {
    id: 'p1',
    name,
    active: true,
    spaces: [
      { id: 's1', name: 'Planta 1', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true },
    ],
  }
}

function validPlan(siteName = 'Site A'): SpacePlanData {
  return {
    v: SPACE_SCHEMA_VERSION,
    activeSiteId: 'site1',
    activePlaceId: 'p1',
    sites: [{ id: 'site1', name: siteName, image: null, active: true, places: [validPlace()] }],
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

describe('sanitizeImage', () => {
  it('accepts a valid png data-URL', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeImage(url)).toBe(url)
  })
  it('accepts jpeg, webp and svg data-URLs', () => {
    for (const mime of ['jpeg', 'jpg', 'webp', 'svg+xml']) {
      const url = `data:image/${mime};base64,AAAA`
      expect(sanitizeImage(url)).toBe(url)
    }
  })
  it('rejects non-image strings and non-strings', () => {
    expect(sanitizeImage('hello')).toBeNull()
    expect(sanitizeImage('data:text/plain;base64,AAAA')).toBeNull()
    expect(sanitizeImage(42)).toBeNull()
    expect(sanitizeImage(null)).toBeNull()
  })
  it('rejects an over-long data-URL', () => {
    const url = 'data:image/png;base64,' + 'A'.repeat(200_000)
    expect(sanitizeImage(url)).toBeNull()
  })
})

describe('defaultSpacePlan', () => {
  it('returns exactly one site with one place', () => {
    const plan = defaultSpacePlan()
    expect(plan.v).toBe(SPACE_SCHEMA_VERSION)
    expect(plan.sites).toHaveLength(1)
    expect(plan.sites[0].image).toBeNull()
    expect(plan.sites[0].places).toHaveLength(1)
    expect(plan.activeSiteId).toBe(plan.sites[0].id)
  })

  it('seeds site, place and space as active', () => {
    const plan = defaultSpacePlan()
    expect(plan.sites[0].active).toBe(true)
    expect(plan.sites[0].places[0].active).toBe(true)
    expect(plan.sites[0].places[0].spaces[0].active).toBe(true)
  })
})

describe('sanitizeSpacePlan (active flag)', () => {
  it('defaults missing active flags to true (legacy plans)', () => {
    const plan = validPlan()
    delete (plan.sites[0] as { active?: boolean }).active
    delete (plan.sites[0].places[0] as { active?: boolean }).active
    delete (plan.sites[0].places[0].spaces[0] as { active?: boolean }).active
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.sites[0].active).toBe(true)
    expect(clean?.sites[0].places[0].active).toBe(true)
    expect(clean?.sites[0].places[0].spaces[0].active).toBe(true)
  })

  it('preserves an explicit active=false at every level', () => {
    const plan = validPlan()
    plan.sites[0].active = false
    plan.sites[0].places[0].active = false
    plan.sites[0].places[0].spaces[0].active = false
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.sites[0].active).toBe(false)
    expect(clean?.sites[0].places[0].active).toBe(false)
    expect(clean?.sites[0].places[0].spaces[0].active).toBe(false)
  })
})

describe('sanitizeSpacePlan (sites)', () => {
  it('keeps a valid plan and its logo', () => {
    const plan = validPlan()
    plan.sites[0].image = 'data:image/png;base64,iVBORw0KGgo='
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.sites[0].image).toBe('data:image/png;base64,iVBORw0KGgo=')
  })
  it('nulls an invalid logo but keeps the site', () => {
    const plan = validPlan()
    ;(plan.sites[0] as { image: unknown }).image = 'nope'
    expect(sanitizeSpacePlan(plan)?.sites[0].image).toBeNull()
  })
  it('drops sites with no usable place', () => {
    const plan = validPlan()
    plan.sites.push({ id: 'empty', name: 'Buit', image: null, active: true, places: [] })
    expect(sanitizeSpacePlan(plan)?.sites).toHaveLength(1)
  })
  it('falls back activeSiteId/activePlaceId to the first available', () => {
    const plan = validPlan()
    plan.activeSiteId = 'ghost'
    plan.activePlaceId = 'ghost'
    const clean = sanitizeSpacePlan(plan)
    expect(clean?.activeSiteId).toBe(clean?.sites[0].id)
    expect(clean?.activePlaceId).toBe(clean?.sites[0].places[0].id)
  })
  it('rejects a wrong schema version', () => {
    expect(sanitizeSpacePlan({ ...validPlan(), v: 2 })).toBeNull()
  })
})

describe('prepareImportedSites', () => {
  it('rejects an incompatible schema version', () => {
    expect(prepareImportedSites({ ...validPlan(), v: 0 }, [])).toBeNull()
  })
  it('recreates sites with fresh ids and preserves the logo', () => {
    const plan = validPlan()
    plan.sites[0].image = 'data:image/png;base64,iVBORw0KGgo='
    const sites = prepareImportedSites(plan, [])
    expect(sites).toHaveLength(1)
    expect(sites?.[0].id).not.toBe('site1')
    expect(sites?.[0].places[0].id).not.toBe('p1')
    expect(sites?.[0].image).toBe('data:image/png;base64,iVBORw0KGgo=')
  })
  it('de-dupes site names against existing names', () => {
    const sites = prepareImportedSites(validPlan('Site A'), ['Site A'])
    expect(sites?.[0].name).toBe('Site A 2')
  })

  it('preserves active flags on imported sites/places/spaces', () => {
    const plan = validPlan()
    plan.sites[0].active = false
    plan.sites[0].places[0].spaces[0].active = false
    const sites = prepareImportedSites(plan, [])
    expect(sites?.[0].active).toBe(false)
    expect(sites?.[0].places[0].active).toBe(true)
    expect(sites?.[0].places[0].spaces[0].active).toBe(false)
  })
})

describe('visiblePlaces / visibleSpaces', () => {
  it('hides places of an inactive site', () => {
    const plan = validPlan()
    plan.sites[0].active = false
    expect(visiblePlaces(plan)).toHaveLength(0)
  })

  it('hides an inactive place', () => {
    const plan = validPlan()
    plan.sites[0].places[0].active = false
    expect(visiblePlaces(plan)).toHaveLength(0)
  })

  it('hides a place whose only space is inactive', () => {
    const plan = validPlan()
    plan.sites[0].places[0].spaces[0].active = false
    expect(visiblePlaces(plan)).toHaveLength(0)
  })

  it('keeps an active place under an active site', () => {
    const plan = validPlan()
    expect(visiblePlaces(plan)).toHaveLength(1)
  })

  it('returns only active spaces of a place', () => {
    const place = validPlace()
    place.spaces = [
      { ...place.spaces[0], id: 'a', active: true },
      { ...place.spaces[0], id: 'b', active: false },
    ]
    expect(visibleSpaces(place).map((s) => s.id)).toEqual(['a'])
  })
})

describe('parseStoredSpacePlan / toWireSpacePlan', () => {
  it('round-trips a v3 plan through the v2 wire shape', () => {
    const plan = validPlan()
    const wire = toWireSpacePlan(plan)
    expect(wire.v).toBe(2)
    expect(wire.places).toHaveLength(1)
    expect(wire.activePlaceId).toBe('p1')
    const restored = parseStoredSpacePlan(wire)
    expect(restored?.sites).toHaveLength(1)
    expect(restored?.sites[0].id).toBe(LEGACY_WIRE_SITE_ID)
    expect(restored?.sites[0].places[0].id).toBe('p1')
  })

  it('upgrades a legacy v2 wire plan into a single site', () => {
    const legacy = { v: 2, activePlaceId: 'p1', places: [validPlace()] }
    const plan = parseStoredSpacePlan(legacy)
    expect(plan?.v).toBe(SPACE_SCHEMA_VERSION)
    expect(plan?.activeSiteId).toBe(LEGACY_WIRE_SITE_ID)
    expect(plan?.sites[0].places).toHaveLength(1)
  })
})

describe('defaultSpacePlan (v4 folders)', () => {
  it('returns one root folder holding one space, both active', () => {
    const plan = defaultSpacePlan()
    expect(plan.v).toBe(4)
    expect(plan.folders).toHaveLength(1)
    expect(plan.folders[0].active).toBe(true)
    expect(plan.folders[0].spaces).toHaveLength(1)
    expect(plan.folders[0].spaces[0].active).toBe(true)
    expect(plan.activeFolderId).toBe(plan.folders[0].id)
    expect(plan.activeSpaceId).toBe(plan.folders[0].spaces[0].id)
  })
})

describe('sanitizeSpacePlan (v4 folder tree)', () => {
  const space = (id: string) => ({ id, name: 'P', cells: [[0, 0]], seats: [], openings: [], dividers: [], dir: 0, active: true })

  it('keeps nested folders, images and empty folders', () => {
    const raw = {
      v: 4,
      activeFolderId: 'f1',
      activeSpaceId: null,
      folders: [
        { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [
          { id: 'f2', name: 'B', image: null, active: true, spaces: [], folders: [] },
        ] },
      ],
    }
    const out = sanitizeSpacePlan(raw)
    expect(out).not.toBeNull()
    expect(out!.folders[0].folders[0].id).toBe('f2') // empty folder preserved
  })

  it('rejects a non-v4 schema', () => {
    expect(sanitizeSpacePlan({ v: 3, sites: [] })).toBeNull()
  })

  it('caps recursion at MAX_FOLDER_DEPTH', () => {
    let node: any = { id: 'leaf', name: 'x', image: null, active: true, spaces: [space('sx')], folders: [] }
    for (let i = 0; i < MAX_FOLDER_DEPTH + 5; i += 1) {
      node = { id: `f${i}`, name: 'x', image: null, active: true, spaces: [], folders: [node] }
    }
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: null, activeSpaceId: null, folders: [node] })
    // Walk down and assert depth never exceeds the cap.
    let depth = 0
    let cur = out!.folders[0]
    while (cur.folders.length > 0) { depth += 1; cur = cur.folders[0] }
    expect(depth + 1).toBeLessThanOrEqual(MAX_FOLDER_DEPTH)
  })

  it('falls back activeFolderId/activeSpaceId when the referenced ids are gone', () => {
    const out = sanitizeSpacePlan({ v: 4, activeFolderId: 'nope', activeSpaceId: 'nope', folders: [
      { id: 'f1', name: 'A', image: null, active: true, spaces: [space('s1')], folders: [] },
    ] })
    expect(out!.activeFolderId).toBe('f1')
    expect(out!.activeSpaceId).toBe('s1')
  })
})
