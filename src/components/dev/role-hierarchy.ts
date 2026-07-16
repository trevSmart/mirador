/* ──────────────────────────────────────────────────────────────────────────
   Role hierarchy (experiment) — deriva un arbre de posicions a partir del camp
   `role` de cada agent, mentre no tinguem la UserRole hierarchy real (amb
   ParentRoleId) al snapshot.

   El camp `role` segueix el patró "{Nivell} · {Equip}" (p.ex. "Sènior · Atenció",
   "Agent · Vendes"). En derivem una jerarquia de 3 nivells:

     Centre de servei
       └─ Equip (Atenció, Vendes, Suport…)
            └─ Sènior (lead de l'equip)
                 └─ Agent

   Els agents no-sènior es reparteixen round-robin entre els sèniors del seu
   equip (determinista) perquè l'arbre reflecteixi una cadena de comandament
   plausible. Si un equip no té cap sènior, els agents pengen directament de
   l'equip. Quan el backend exposi ParentRoleId, aquesta funció es reemplaça per
   una que segueixi els parents reals.
   ────────────────────────────────────────────────────────────────────────── */

import type { Agent } from '../../api/types'

export type RoleNodeKind = 'root' | 'team' | 'agent'

export interface RoleNode {
  id: string
  /** Etiqueta a mostrar (nom de l'equip, nom de l'agent o el títol de l'arrel). */
  label: string
  kind: RoleNodeKind
  /** Present només als nodes d'agent. */
  agent?: Agent
  /** Nombre d'agents en aquest subarbre (inclòs ell mateix si és agent). */
  headcount: number
  children: RoleNode[]
}

export interface ParsedRole {
  seniority: string
  team: string
  isLead: boolean
}

const TEAM_UNKNOWN = 'Sense equip'

/** Parteix "Sènior · Atenció" en { seniority: 'Sènior', team: 'Atenció' }. */
export function parseRole(role: string): ParsedRole {
  const parts = role.split('·').map((p) => p.trim())
  const seniority = parts[0] || 'Agent'
  const team = parts.length > 1 && parts[1] ? parts[1] : TEAM_UNKNOWN
  // Un "Sènior" (o qualsevol nivell diferent d'"Agent") actua com a lead.
  const isLead = seniority.toLocaleLowerCase('ca').startsWith('sènior')
  return { seniority, team, isLead }
}

function agentNode(agent: Agent): RoleNode {
  return { id: agent.id, label: agent.name, kind: 'agent', agent, headcount: 1, children: [] }
}

/** Suma recursiva d'agents del subarbre; el fixem un cop construït l'arbre. */
function countAgents(node: RoleNode): number {
  if (node.kind === 'agent') {
    node.headcount = 1 + node.children.reduce((n, c) => n + countAgents(c), 0)
    return node.headcount
  }
  node.headcount = node.children.reduce((n, c) => n + countAgents(c), 0)
  return node.headcount
}

const byName = (a: Agent, b: Agent) => a.name.localeCompare(b.name, 'ca')

export function buildRoleHierarchy(
  agents: Agent[],
  rootLabel = 'Centre de servei',
): RoleNode {
  const root: RoleNode = { id: '__root__', label: rootLabel, kind: 'root', headcount: 0, children: [] }

  // Agrupa per equip preservant un ordre alfabètic estable.
  const teams = new Map<string, Agent[]>()
  for (const agent of agents) {
    const { team } = parseRole(agent.role)
    const bucket = teams.get(team)
    if (bucket) bucket.push(agent)
    else teams.set(team, [agent])
  }

  for (const team of [...teams.keys()].sort((a, b) => a.localeCompare(b, 'ca'))) {
    const members = teams.get(team)!
    const teamNode: RoleNode = {
      id: `team:${team}`,
      label: team,
      kind: 'team',
      headcount: 0,
      children: [],
    }

    const leads = members.filter((a) => parseRole(a.role).isLead).sort(byName)
    const rest = members.filter((a) => !parseRole(a.role).isLead).sort(byName)

    if (leads.length === 0) {
      // Cap lead: tot l'equip penja directament del node d'equip.
      for (const a of rest) teamNode.children.push(agentNode(a))
    } else {
      const leadNodes = leads.map(agentNode)
      for (const node of leadNodes) teamNode.children.push(node)
      // Reparteix els agents entre els leads de forma determinista (round-robin).
      rest.forEach((a, i) => leadNodes[i % leadNodes.length].children.push(agentNode(a)))
    }

    root.children.push(teamNode)
  }

  countAgents(root)
  return root
}
