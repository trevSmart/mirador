export type PresenceStatus = 'online' | 'busy' | 'away' | 'offline'
export type ChannelKey = 'veu' | 'chat' | 'email' | 'wa' | 'cas'
export type WorkStatus = 'assigned' | 'queued'
export type AgentScope = 'connected' | 'all'

export interface ChannelCounts {
  veu: number
  chat: number
  email: number
  wa: number
  cas: number
}

export interface AgentWorkItem {
  id: string
  recordId: string | null
  label: string
  subject: string | null
  channel: string | null
  channelKey: ChannelKey
  status: string
  queue: string | null
  queueId: string | null
  ageMin: number
}

export interface AgentSkill {
  id: string
  skillId: string | null
  name: string
  type: string | null
  level: number | null
  startDate: string | null
  lastModifiedDate: string | null
  lastModifiedBy: string | null
}

export interface Agent {
  id: string
  name: string
  role: string
  recordUrl: string | null
  status: PresenceStatus
  max: number
  used: number
  queueIds: string[]
  loginMin: number
  photo: string | null
  chans: ChannelCounts
  work: AgentWorkItem[]
  skills: AgentSkill[]
}

export interface Queue {
  id: string
  name: string
  color: string
  backlog: number
  longest: number
  avg: number
  online: number
}

export interface Skill {
  id: string
  name: string
  type: string | null
  agents: number
  backlog: number
}

export interface WorkItem {
  id: string
  subject: string
  channelKey: ChannelKey
  queueId: string | null
  agentId: string | null
  status: WorkStatus
  ageSec: number
}

export interface Capabilities {
  canChangePresence: boolean
  canReassignWork: boolean
  canChangeQueues: boolean
  canChangeSkills: boolean
  canFlagAgent: boolean
  liveUpdates: boolean
}

export interface AgentSkillChange {
  skillId: string
  level?: number
  remove?: boolean
}

export interface ApiErrorBody {
  error: string
  path?: string
}

export interface AgentsResponse {
  agents: Agent[]
}

export interface AgentSkillsResponse {
  skills: AgentSkill[]
}

export interface QueuesResponse {
  queues: Queue[]
}

export interface SkillsResponse {
  skills: Skill[]
}

export interface WorkResponse {
  work: WorkItem[]
}

export interface SkillAgentsResponse {
  agents: Agent[]
}

export interface UpdateSkillsRequest {
  changes: AgentSkillChange[]
}

export interface UpdateSkillsResponse {
  ok: boolean
}
