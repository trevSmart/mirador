import { describe, expect, it } from 'vitest'
import type { IDockviewPanel } from 'dockview-react'
import { destinationFromPanel, parseNavHash, serializeNavHash, type NavDestination } from './nav-hash'

function fakePanel(contentComponent: string | undefined, params?: unknown): IDockviewPanel {
  return { view: { contentComponent }, params } as unknown as IDockviewPanel
}

describe('serializeNavHash', () => {
  it('serializes registry panels to their literal type', () => {
    expect(serializeNavHash({ kind: 'panel', panel: 'home' })).toBe('#home')
    expect(serializeNavHash({ kind: 'panel', panel: 'spaceEditor' })).toBe('#spaceEditor')
  })

  it('serializes detail targets with URI-encoded ids', () => {
    expect(serializeNavHash({ kind: 'detail', target: { kind: 'agent', id: 'a/b c%' } })).toBe(
      '#detail/agent/a%2Fb%20c%25',
    )
  })
})

describe('parseNavHash', () => {
  it('round-trips panel and detail destinations', () => {
    const destinations: NavDestination[] = [
      { kind: 'panel', panel: 'queues' },
      { kind: 'detail', target: { kind: 'work', id: 'w#1/2 %x' } },
    ]
    for (const dest of destinations) {
      expect(parseNavHash(serializeNavHash(dest))).toEqual(dest)
    }
  })

  it('accepts hashes with or without the leading #', () => {
    expect(parseNavHash('agents')).toEqual({ kind: 'panel', panel: 'agents' })
    expect(parseNavHash('#agents')).toEqual({ kind: 'panel', panel: 'agents' })
  })

  it('rejects empty and unknown hashes', () => {
    expect(parseNavHash('')).toBeNull()
    expect(parseNavHash('#')).toBeNull()
    expect(parseNavHash('#nope')).toBeNull()
  })

  it('rejects malformed detail hashes', () => {
    expect(parseNavHash('#detail')).toBeNull()
    expect(parseNavHash('#detail/')).toBeNull()
    expect(parseNavHash('#detail/bogus/x')).toBeNull()
    expect(parseNavHash('#detail/agent/')).toBeNull()
    expect(parseNavHash('#detail/agent/%')).toBeNull()
  })
})

describe('destinationFromPanel', () => {
  it('maps a registry panel', () => {
    expect(destinationFromPanel(fakePanel('agents'))).toEqual({ kind: 'panel', panel: 'agents' })
  })

  it('maps a detail panel via its params', () => {
    expect(destinationFromPanel(fakePanel('detail', { kind: 'queue', id: 'q1' }))).toEqual({
      kind: 'detail',
      target: { kind: 'queue', id: 'q1' },
    })
  })

  it('returns null for unknown components or invalid detail params', () => {
    expect(destinationFromPanel(fakePanel('insights'))).toBeNull()
    expect(destinationFromPanel(fakePanel(undefined))).toBeNull()
    expect(destinationFromPanel(fakePanel('detail', { kind: 'bogus', id: 'x' }))).toBeNull()
  })
})
