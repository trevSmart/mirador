import { afterEach, describe, expect, it } from 'vitest'
import { loadPreferences, PREFERENCES_DEFAULTS, PREFERENCES_KEY, savePreferences } from './preferences'

afterEach(() => {
  localStorage.clear()
})

describe('loadPreferences — theme sanitization', () => {
  it('defaults to system when nothing is stored', () => {
    expect(loadPreferences().theme).toBe('system')
  })

  it.each(['light', 'dark', 'system'] as const)('accepts a stored %s', (theme) => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme }))
    expect(loadPreferences().theme).toBe(theme)
  })

  it.each([['solarized'], [42], [null], [true]])('coerces invalid value %j to system', (theme) => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme }))
    expect(loadPreferences().theme).toBe('system')
  })

  it('coerces a missing theme field on an otherwise valid blob', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ lang: 'en' }))
    const prefs = loadPreferences()
    expect(prefs.theme).toBe('system')
    expect(prefs.lang).toBe('en')
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not json')
    expect(loadPreferences()).toEqual(PREFERENCES_DEFAULTS)
  })
})

describe('savePreferences round-trip', () => {
  it('persists the theme and survives a reload', () => {
    savePreferences({ ...PREFERENCES_DEFAULTS, theme: 'dark' })
    expect(loadPreferences().theme).toBe('dark')
  })
})
