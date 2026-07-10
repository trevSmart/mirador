import { describe, expect, it } from 'vitest'
import { orderByPinned } from './pin-actions'

interface Item {
  id: string
  pinned: boolean
}

const pinned = (item: Item) => item.pinned
const ids = (items: Item[]) => items.map((item) => item.id)

describe('orderByPinned', () => {
  it('mou els fixats a l’esquerra preservant l’ordre relatiu de cada zona', () => {
    const items: Item[] = [
      { id: 'a', pinned: false },
      { id: 'b', pinned: true },
      { id: 'c', pinned: false },
      { id: 'd', pinned: true },
    ]
    expect(ids(orderByPinned(items, pinned))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('deixa l’ordre intacte quan els fixats ja són a l’esquerra', () => {
    const items: Item[] = [
      { id: 'b', pinned: true },
      { id: 'd', pinned: true },
      { id: 'a', pinned: false },
      { id: 'c', pinned: false },
    ]
    expect(ids(orderByPinned(items, pinned))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('un fixat arrossegat a la zona no fixada torna arran de la frontera', () => {
    // b (fixat) s’ha deixat anar entre a i c (no fixats): la partició estable
    // el retorna a la dreta dels altres fixats, just a la frontera.
    const afterDrag: Item[] = [
      { id: 'p1', pinned: true },
      { id: 'a', pinned: false },
      { id: 'b', pinned: true },
      { id: 'c', pinned: false },
    ]
    expect(ids(orderByPinned(afterDrag, pinned))).toEqual(['p1', 'b', 'a', 'c'])
  })

  it('gestiona llistes totalment fixades o gens fixades', () => {
    const allPinned: Item[] = [
      { id: 'x', pinned: true },
      { id: 'y', pinned: true },
    ]
    const nonePinned: Item[] = [
      { id: 'x', pinned: false },
      { id: 'y', pinned: false },
    ]
    expect(ids(orderByPinned(allPinned, pinned))).toEqual(['x', 'y'])
    expect(ids(orderByPinned(nonePinned, pinned))).toEqual(['x', 'y'])
  })
})
