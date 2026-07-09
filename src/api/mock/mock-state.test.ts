import { describe, expect, it } from 'vitest'
import {
  applyMockSkillChanges,
  getMockAgentSkills,
  getMockAgents,
  getMockSkills,
  getMockWork,
} from './mock-state'

/** Tria un skill que l'agent donat NO tingui, per provar assignacions netes. */
function pickUnassignedSkillId(agentId: string): string {
  const current = new Set(getMockAgentSkills(agentId).map((s) => s.skillId))
  const skill = getMockSkills().find((s) => !current.has(s.id))
  if (!skill) throw new Error('cap skill lliure per a les proves')
  return skill.id
}

describe('mock-state — overrides de skills', () => {
  it('assignar un skill nou persisteix a getMockAgents i a una segona crida', () => {
    const agent = getMockAgents()[1]
    const skillId = pickUnassignedSkillId(agent.id)

    applyMockSkillChanges(agent.id, [{ skillId, level: 3 }])

    const first = getMockAgents().find((a) => a.id === agent.id)
    expect(first?.skills.some((s) => s.skillId === skillId && s.level === 3)).toBe(true)

    const second = getMockAgents().find((a) => a.id === agent.id)
    expect(second?.skills.some((s) => s.skillId === skillId && s.level === 3)).toBe(true)
  })

  it('treure un skill (remove: true) el fa desaparèixer', () => {
    const agent = getMockAgents()[2]
    const existing = getMockAgentSkills(agent.id)[0]
    if (!existing?.skillId) throw new Error("l'agent de prova no té cap skill assignat")

    applyMockSkillChanges(agent.id, [{ skillId: existing.skillId, remove: true }])

    const updated = getMockAgentSkills(agent.id)
    expect(updated.some((s) => s.skillId === existing.skillId)).toBe(false)
  })

  it('canviar el nivell d\'un skill existent actualitza el level', () => {
    const agent = getMockAgents()[3]
    const existing = getMockAgentSkills(agent.id)[0]
    if (!existing?.skillId) throw new Error("l'agent de prova no té cap skill assignat")

    applyMockSkillChanges(agent.id, [{ skillId: existing.skillId, level: 5 }])

    const updated = getMockAgentSkills(agent.id).find((s) => s.skillId === existing.skillId)
    expect(updated?.level).toBe(5)
  })

  it('getMockSkills reflecteix el recompte d\'agents després d\'una assignació', () => {
    const agent = getMockAgents()[4]
    const skillId = pickUnassignedSkillId(agent.id)
    const before = getMockSkills().find((s) => s.id === skillId)?.agents ?? 0

    applyMockSkillChanges(agent.id, [{ skillId, level: 2 }])

    const after = getMockSkills().find((s) => s.id === skillId)?.agents ?? 0
    expect(after).toBe(before + 1)
  })
})

describe('mock-state — work items porten recordId per resoldre el detall', () => {
  it('un work item de canal cas té un workItemId de Case (500…)', () => {
    const work = getMockWork()
    const caseItem = work.find((w) => w.channelKey === 'cas' && w.status === 'assigned')
    expect(caseItem, 'hi ha d\'haver almenys un cas assignat al mock').toBeDefined()
    expect(caseItem?.workItemId).toBeTruthy()
    expect(caseItem?.workItemId?.startsWith('500')).toBe(true)
  })

  it('un work item de xat té un workItemId de MessagingSession (0Mw…)', () => {
    const work = getMockWork()
    const chatItem = work.find((w) => w.channelKey === 'chat' && w.status === 'assigned')
    expect(chatItem, 'hi ha d\'haver almenys un xat assignat al mock').toBeDefined()
    expect(chatItem?.workItemId?.startsWith('0Mw')).toBe(true)
  })
})
