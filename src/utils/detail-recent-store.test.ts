import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDetailRecents,
  getDetailRecentsVersion,
  recordDetailOpen,
  setDetailRecentResolver,
  subscribeDetailRecents,
} from './detail-recent-store'

function installResolver() {
  setDetailRecentResolver(({ kind, id }) => {
    if (kind !== 'agent' && kind !== 'queue' && kind !== 'skill') return null
    return { kind, id, title: `Títol ${id}`, meta: '' }
  })
}

/* L'store és a nivell de mòdul: cada subscripció es registra aquí i es
   desfà a l'afterEach perquè cap listener no es filtri entre tests. */
const unsubscribes: Array<() => void> = []

function subscribeForTest(listener: () => void): void {
  unsubscribes.push(subscribeDetailRecents(listener))
}

describe('detail-recent-store — subscripció', () => {
  beforeEach(() => {
    localStorage.clear()
    installResolver()
  })

  afterEach(() => {
    setDetailRecentResolver(null)
    for (const unsubscribe of unsubscribes.splice(0)) unsubscribe()
  })

  it('notifica els listeners a cada escriptura', () => {
    const listener = vi.fn()
    subscribeForTest(listener)

    recordDetailOpen({ kind: 'agent', id: 'a1' })
    expect(listener).toHaveBeenCalledTimes(1)

    recordDetailOpen({ kind: 'queue', id: 'q1' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('incrementa la versió a cada escriptura', () => {
    const before = getDetailRecentsVersion()
    recordDetailOpen({ kind: 'agent', id: 'a1' })
    expect(getDetailRecentsVersion()).toBe(before + 1)
    recordDetailOpen({ kind: 'agent', id: 'a2' })
    expect(getDetailRecentsVersion()).toBe(before + 2)
  })

  it('el listener veu la llista ja actualitzada quan se’l notifica', () => {
    const seen: string[][] = []
    subscribeForTest(() => {
      seen.push(getDetailRecents().map((entry) => entry.id))
    })

    recordDetailOpen({ kind: 'agent', id: 'a1' })
    recordDetailOpen({ kind: 'agent', id: 'a2' })

    expect(seen).toEqual([['a1'], ['a2', 'a1']])
  })

  it('unsubscribe atura les notificacions', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeDetailRecents(listener)

    recordDetailOpen({ kind: 'agent', id: 'a1' })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    recordDetailOpen({ kind: 'agent', id: 'a2' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('no notifica quan l’escriptura es descarta', () => {
    const listener = vi.fn()
    subscribeForTest(listener)
    const before = getDetailRecentsVersion()

    // Kind invàlid: recordDetailOpen no escriu res.
    recordDetailOpen({ kind: 'work', id: 'w1' })
    // Resolver que descarta l'entrada: tampoc.
    setDetailRecentResolver(() => null)
    recordDetailOpen({ kind: 'agent', id: 'a1' })

    expect(listener).not.toHaveBeenCalled()
    expect(getDetailRecentsVersion()).toBe(before)
  })
})
