import { describe, expect, it } from 'vitest'
import { buildRoleHierarchy, parseRole, type RoleNode } from './role-hierarchy'
import type { Agent } from '../../api/types'

function agent(id: string, name: string, role: string): Agent {
  return {
    id,
    name,
    role,
    recordUrl: null,
    status: 'online',
    presenceStatusId: null,
    presenceStatusLabel: null,
    max: 5,
    used: 0,
    queueIds: [],
    loginMin: 0,
    photo: null,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skills: [],
  }
}

const childIds = (node: RoleNode) => node.children.map((c) => c.id)

describe('parseRole', () => {
  it('parteix "{Nivell} · {Equip}" i marca els sèniors com a lead', () => {
    expect(parseRole('Sènior · Atenció')).toEqual({ seniority: 'Sènior', team: 'Atenció', isLead: true })
    expect(parseRole('Agent · Vendes')).toEqual({ seniority: 'Agent', team: 'Vendes', isLead: false })
  })

  it('gestiona rols sense equip', () => {
    const parsed = parseRole('Coordinador')
    expect(parsed.team).toBe('Sense equip')
    expect(parsed.isLead).toBe(false)
  })
})

describe('buildRoleHierarchy', () => {
  it('agrupa per equip (ordenat) sota l’arrel i compta els caps', () => {
    const root = buildRoleHierarchy([
      agent('a1', 'Pau', 'Agent · Vendes'),
      agent('a2', 'Aina', 'Agent · Atenció'),
    ])

    expect(root.kind).toBe('root')
    expect(root.headcount).toBe(2)
    // Equips ordenats alfabèticament: Atenció abans que Vendes.
    expect(root.children.map((c) => c.label)).toEqual(['Atenció', 'Vendes'])
    expect(root.children.every((c) => c.kind === 'team')).toBe(true)
  })

  it('penja els agents dels leads del mateix equip (round-robin determinista)', () => {
    const root = buildRoleHierarchy([
      agent('lead', 'Núria', 'Sènior · Suport'),
      agent('j1', 'Bru', 'Agent · Suport'),
      agent('j2', 'Ada', 'Agent · Suport'),
    ])

    const team = root.children[0]
    expect(team.label).toBe('Suport')
    // Un sol lead → tots els agents pengen d'ell.
    expect(childIds(team)).toEqual(['lead'])
    const lead = team.children[0]
    // Agents ordenats per nom (Ada, Bru).
    expect(childIds(lead)).toEqual(['j2', 'j1'])
    expect(lead.headcount).toBe(3)
  })

  it('sense cap lead, els agents pengen directament de l’equip', () => {
    const root = buildRoleHierarchy([
      agent('a1', 'Pau', 'Agent · Vendes'),
      agent('a2', 'Aina', 'Agent · Vendes'),
    ])

    const team = root.children[0]
    expect(childIds(team).sort()).toEqual(['a1', 'a2'])
    expect(team.children.every((c) => c.children.length === 0)).toBe(true)
  })

  it('reparteix els agents entre múltiples leads round-robin', () => {
    const root = buildRoleHierarchy([
      agent('L1', 'Berta', 'Sènior · Atenció'),
      agent('L2', 'Dídac', 'Sènior · Atenció'),
      agent('j1', 'Ona', 'Agent · Atenció'),
      agent('j2', 'Pol', 'Agent · Atenció'),
      agent('j3', 'Quim', 'Agent · Atenció'),
    ])

    const team = root.children[0]
    const [lead1, lead2] = team.children
    // 3 agents (Ona, Pol, Quim) repartits: L1←Ona,Quim · L2←Pol
    expect(childIds(lead1)).toEqual(['j1', 'j3'])
    expect(childIds(lead2)).toEqual(['j2'])
  })
})
