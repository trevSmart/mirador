/* ──────────────────────────────────────────────────────────────────────────
   Dev Lab 2 — banc de proves derivat del Dev Lab per experimentar amb noves
   visualitzacions. L'experiment actiu: veure la jerarquia de posicions dels
   agents (org-chart) derivada de la role hierarchy de Salesforce.

   Nota: mentre el snapshot no exposi la UserRole hierarchy real (ParentRoleId),
   l'arbre es deriva del camp `role` ("{Nivell} · {Equip}"). Veure
   src/components/dev/role-hierarchy.ts.
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import type { Agent, PresenceStatus } from '../api/types'
import { useAgents } from '../api/data-hooks'
import { AgentCard } from '../components/AgentCard'
import { buildRoleHierarchy, parseRole, type RoleNode } from '../components/dev/role-hierarchy'
import { capacityColor } from '../utils/agent-stats'
import { colorFromRecordId, textColorFromRecordId } from '../utils/color-from-string'
import { agentInitials } from '../utils/format'
import { useSalesforcePhoto } from '../hooks/useSalesforcePhoto'
import { useDetailDrawer } from '../detail/detail-drawer-context'
import { useCardActivation } from '../hooks/useCardActivation'
import { AppIcon, Ring } from '../components/ds'
import { AgentPresenceBadge } from '../components/AgentPresenceBadge'

/** Mateixa xarxa de seguretat que `useCollapsible`: si `transitionend` no
    dispara (doble toggle al mateix frame), `animating` no pot quedar enganxat. */
const SETTLE_FALLBACK_MS = 420

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'var(--status-ok)',
  busy: 'var(--status-alert)',
  away: 'var(--status-watch)',
  offline: 'var(--text-disabled)',
}

/* ── Node d'agent dins l'arbre ──────────────────────────────────────────── */

function AgentRow({ agent, isLead }: { agent: Agent; isLead: boolean }) {
  const { openAgent } = useDetailDrawer()
  const photoSrc = useSalesforcePhoto(agent.photo)

  const openDetail = (event: SyntheticEvent) => {
    event.stopPropagation()
    openAgent(agent.id)
  }

  return (
    <div className="role-tree__agent">
      {/* La fila sencera commuta el plegat; l'avatar és la via accessible per
          obrir el detall (útil sobretot per als leads, on la fila plega). */}
      <button
        type="button"
        className="role-tree__avatar"
        onClick={openDetail}
        onKeyDown={(event) => {
          // Evita que Enter/Espai també activin el toggle de la fila pare.
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openDetail(event)
          }
        }}
        title={`Obre el detall de ${agent.name}`}
        aria-label={`Obre el detall de ${agent.name}`}
      >
        <Ring
          used={agent.used}
          max={agent.max}
          color={capacityColor(agent)}
          size={32}
          photo={photoSrc}
          initials={agentInitials(agent.name)}
          breathe={agent.status === 'busy'}
        />
        <span className="role-tree__dot" style={{ background: STATUS_COLOR[agent.status] }} aria-hidden="true" />
      </button>
      <div className="role-tree__agent-body">
        <span className="role-tree__agent-name">
          {agent.name}
          {isLead && <span className="role-tree__role-tag">{parseRole(agent.role).seniority}</span>}
        </span>
        <span className="role-tree__agent-role">{agent.role}</span>
      </div>
      <AgentPresenceBadge agent={agent} />
    </div>
  )
}

/* ── Node de grup (arrel / equip) ──────────────────────────────────────── */

function GroupHeader({ node }: { node: RoleNode }) {
  const color = node.kind === 'root' ? 'var(--brand)' : colorFromRecordId(node.id)
  return (
    <div className="role-tree__group-head">
      <span
        className="role-tree__group-swatch"
        style={{ background: color, color: textColorFromRecordId(node.id) }}
        aria-hidden="true"
      >
        {node.label.slice(0, 2).toLocaleUpperCase('ca')}
      </span>
      <span className="role-tree__group-name">{node.label}</span>
      <span className="role-tree__group-count">{node.headcount}</span>
    </div>
  )
}

/* ── Renderitzat recursiu de l'arbre ───────────────────────────────────── */

function TreeNode({
  node,
  depth,
  collapsed,
  toggle,
  parentIsLead,
}: {
  node: RoleNode
  depth: number
  collapsed: Set<string>
  toggle: (id: string) => void
  parentIsLead: boolean
}) {
  const { openAgent } = useDetailDrawer()
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  // Igual que CollapsibleGroup: mantenim `overflow: visible` només un cop
  // acabada la transició de grid, perquè els nivells niats no es retallin mentre
  // s'animen.
  const [animating, setAnimating] = useState(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overflowVisible = !isCollapsed && !animating
  const isAgent = node.kind === 'agent'

  const clearSettleTimer = () => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }

  const markAnimating = () => {
    setAnimating(true)
    clearSettleTimer()
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null
      setAnimating(false)
    }, SETTLE_FALLBACK_MS)
  }

  const settle = () => {
    clearSettleTimer()
    setAnimating(false)
  }

  useEffect(() => clearSettleTimer, [])

  // Clic a qualsevol punt de la fila: plega/desplega si té fills; si és un
  // agent-fulla (sense subordinats), obre el seu detall.
  const rowAction = hasChildren
    ? () => {
        toggle(node.id)
        markAnimating()
      }
    : () => openAgent(node.agent!.id)
  const activation = useCardActivation(rowAction)

  return (
    <li className={`role-tree__item${isAgent ? '' : ' role-tree__item--group'}`}>
      <div
        className="role-tree__row role-tree__row--clickable"
        {...activation}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
      >
        <span className="role-tree__toggle" aria-hidden="true">
          {hasChildren && (
            <AppIcon
              name="chevronright"
              size={14}
              className={`role-tree__chevron${isCollapsed ? '' : ' role-tree__chevron--open'}`}
            />
          )}
        </span>
        {isAgent ? (
          <AgentRow agent={node.agent!} isLead={parentIsLead || hasChildren} />
        ) : (
          <GroupHeader node={node} />
        )}
      </div>

      {hasChildren && (
        <div
          className={`role-tree__expand${isCollapsed ? '' : ' is-open'}`}
          onTransitionEnd={(event) => {
            if (event.propertyName === 'grid-template-rows') settle()
          }}
        >
          <div className={`role-tree__expand-inner${overflowVisible ? ' is-visible' : ''}`}>
            <ul className="role-tree__children">
              {node.children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  collapsed={collapsed}
                  toggle={toggle}
                  parentIsLead={node.kind === 'team'}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

function RoleHierarchyTree({ agents }: { agents: Agent[] }) {
  const root = useMemo(() => buildRoleHierarchy(agents), [agents])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allGroupIds = useMemo(() => collectGroupIds(root), [root])

  return (
    <div className="role-tree">
      <div className="role-tree__toolbar">
        <button type="button" className="role-tree__btn" onClick={() => setCollapsed(new Set())}>
          Desplega-ho tot
        </button>
        <button type="button" className="role-tree__btn" onClick={() => setCollapsed(new Set(allGroupIds))}>
          Plega-ho tot
        </button>
      </div>
      <ul className="role-tree__children role-tree__root">
        <TreeNode node={root} depth={0} collapsed={collapsed} toggle={toggle} parentIsLead={false} />
      </ul>
    </div>
  )
}

/** Recull tots els ids de node de grup (arrel + equips) per «plega-ho tot». */
function collectGroupIds(node: RoleNode, acc: string[] = []): string[] {
  if (node.kind !== 'agent') acc.push(node.id)
  for (const child of node.children) collectGroupIds(child, acc)
  return acc
}

/* ── Panell ────────────────────────────────────────────────────────────── */

export function DevLab2Panel() {
  const agents = useAgents()
  const sample = agents.slice(0, 6)

  return (
    <div className="dev-lab">
      <div className="dev-lab-compare">
        <p className="dev-lab-compare__label">Experiment · Jerarquia de rols (derivada de la role hierarchy)</p>
        <p className="dev-lab-note">
          Arbre de posicions derivat del camp <code>role</code> mentre el snapshot no exposi la
          UserRole hierarchy real (ParentRoleId). Equip → Lead (Sènior) → Agent.
        </p>
        <RoleHierarchyTree agents={agents} />
      </div>

      <div className="dev-lab-compare">
        <p className="dev-lab-compare__label">Aspecte actual (targetes)</p>
        <div className="agents-grid">
          {sample.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
