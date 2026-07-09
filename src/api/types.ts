export type PresenceStatus = 'online' | 'busy' | 'away' | 'offline'
export type ChannelKey = 'veu' | 'chat' | 'email' | 'wa' | 'cas'
export type WorkStatus = 'assigned' | 'queued'
export type AgentScope = 'connected' | 'all'

interface ChannelCounts {
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
  /** Normalized presence category, used for colors/sorting. */
  status: PresenceStatus
  /**
   * The org's real Omni-Channel presence status id, or null when the agent has
   * no active presence (offline). Distinct from `status`, which is our coarse
   * normalization — this is the configured status the agent actually selected.
   */
  presenceStatusId: string | null
  /** The real presence status display label (e.g. "Disponible per a veu"). */
  presenceStatusLabel: string | null
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
  backlog: number
  longest: number
  avg: number
  online: number
}

export interface Skill {
  id: string
  name: string
  type: string | null
  typeId: string | null
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
  workItemId?: string | null
  objectApiName?: string | null
  iconName?: string | null
  iconSprite?: string | null
  iconSymbol?: string | null
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

/** A presence status configured in the org (Setup → Presence Statuses). */
export interface PresenceStatusOption {
  id: string
  label: string
}

export interface SnapshotResponse {
  agents: Agent[]
  queues: Queue[]
  skills: Skill[]
  work: WorkItem[]
  /** Full catalog of org presence statuses; drives Home's per-status filters. */
  presenceStatuses: PresenceStatusOption[]
}

export interface RecordDetail {
  id: string
  objectApiName: string | null
  createdDate: string | null
  lastModifiedDate: string | null
  caseNumber?: string | null
  subject?: string | null
  recordStatus?: string | null
  recordClosed?: boolean | null
}

export interface RecordDetailsRequest {
  ids: string[]
}

export interface RecordDetailsResponse {
  records: RecordDetail[]
}

/** One time span on the agent timeline. `end === null` means still ongoing
    (the band/bar extends to "now"). Timestamps are ISO 8601, matching Apex. */
export interface TimelineSegment {
  id: string
  start: string
  end: string | null
  label: string
}

/** A presence-status band. Designed to map from UserServicePresence
    (StatusStartDate → start, StatusEndDate → end). `status` is our coarse
    category (drives the band color); `presenceLabel` is the org's real label. */
export interface PresenceSegment extends TimelineSegment {
  status: PresenceStatus
  presenceLabel: string
}

/** A work bar (AgentWork): RequestDateTime → start, CloseDateTime → end. */
export interface WorkSegment extends TimelineSegment {
  channelKey: ChannelKey
  recordId: string | null
  queue: string | null
}

/** One agent's activity for a single day: presence bands + work bars. */
export interface AgentTimeline {
  agentId: string
  /** ISO date (YYYY-MM-DD) the timeline covers. */
  day: string
  presence: PresenceSegment[]
  work: WorkSegment[]
}

export interface AgentTimelineResponse {
  timeline: AgentTimeline
}
