import { describe, expect, it, vi } from 'vitest'
import { handleBfcacheRestore } from './reload-on-bfcache-restore'

describe('handleBfcacheRestore', () => {
  it('reloads when the page is restored from the back/forward cache', () => {
    const reload = vi.fn()
    handleBfcacheRestore({ persisted: true } as PageTransitionEvent, reload)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing on a normal (non-bfcache) page load', () => {
    const reload = vi.fn()
    handleBfcacheRestore({ persisted: false } as PageTransitionEvent, reload)
    expect(reload).not.toHaveBeenCalled()
  })
})
