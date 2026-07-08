import { describe, expect, it } from 'vitest'
import { resolvePresenceStatus } from './mock-seed'

const constRand = (value: number) => () => value

describe('resolvePresenceStatus', () => {
  it('offline no té presence status', () => {
    expect(resolvePresenceStatus('offline', null, constRand(0.5))).toBeNull()
  })

  it('busy sempre resol a un únic status (En trucada)', () => {
    const a = resolvePresenceStatus('busy', null, constRand(0))
    const b = resolvePresenceStatus('busy', null, constRand(0.99))
    expect(a?.label).toBe('En trucada')
    expect(b?.id).toBe(a?.id)
  })

  it('online reparteix entre Disponible i Disponible per a veu', () => {
    const primary = resolvePresenceStatus('online', null, constRand(0.01))
    const secondary = resolvePresenceStatus('online', null, constRand(0.99))
    expect(primary?.label).toBe('Disponible')
    expect(secondary?.label).toBe('Disponible per a veu')
  })

  it('away pot resoldre a En pausa, Dinar o Reunió segons el pes', () => {
    expect(resolvePresenceStatus('away', null, constRand(0.01))?.label).toBe('En pausa')
    expect(resolvePresenceStatus('away', null, constRand(0.99))?.label).toBe('Reunió')
  })

  it('és sticky: manté el status actual si encara és vàlid per la categoria', () => {
    const first = resolvePresenceStatus('away', null, constRand(0.01)) // En pausa
    // rand 0.99 triaria Reunió si no fos sticky
    const again = resolvePresenceStatus('away', first?.id ?? null, constRand(0.99))
    expect(again?.id).toBe(first?.id)
  })

  it('re-roda en creuar de categoria (un status away no val per online)', () => {
    const away = resolvePresenceStatus('away', null, constRand(0.01)) // id d'En pausa
    const online = resolvePresenceStatus('online', away?.id ?? null, constRand(0.01))
    expect(online?.label).toMatch(/Disponible/)
  })
})
