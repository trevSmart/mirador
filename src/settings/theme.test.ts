import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getAppliedTheme,
  resolveTheme,
  subscribeAppliedTheme,
  THEME_EVENT,
} from './theme'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('resolveTheme(%s, systemDark=%s) → %s', (pref, systemDark, expected) => {
    expect(resolveTheme(pref, systemDark)).toBe(expected)
  })
})

describe('applyTheme / getAppliedTheme', () => {
  it('defaults to light when no data-theme is set', () => {
    expect(getAppliedTheme()).toBe('light')
  })

  it('stamps data-theme on <html> and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAppliedTheme(listener)
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(getAppliedTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('does not re-notify when the theme is unchanged', () => {
    applyTheme('dark')
    const listener = vi.fn()
    const unsubscribe = subscribeAppliedTheme(listener)
    applyTheme('dark')
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn()
    subscribeAppliedTheme(listener)()
    window.dispatchEvent(new Event(THEME_EVENT))
    expect(listener).not.toHaveBeenCalled()
  })
})
