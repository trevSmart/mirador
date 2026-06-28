import { recoverAccessSession } from '../auth/salesforce-oauth'
import { devLog } from '../dev/dev-log'
import type { OAuthSession } from '../auth/types'
import type { SpacePlanData } from '../space/types'
import type {
  AgentScope,
  AgentSkillsResponse,
  AgentsResponse,
  ApiErrorBody,
  Capabilities,
  QueuesResponse,
  RecordDetailsRequest,
  RecordDetailsResponse,
  SkillAgentsResponse,
  SkillsResponse,
  SnapshotResponse,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
  WorkResponse,
} from './types'

const MIRADOR_API_PATH = '/services/apexrest/mirador/v1'

export class MiradorApiError extends Error {
  status: number
  path?: string

  constructor(message: string, status: number, path?: string) {
    super(message)
    this.name = 'MiradorApiError'
    this.status = status
    this.path = path
  }
}

export interface MiradorClient {
  getCapabilities: () => Promise<Capabilities>
  getAgents: (scope?: AgentScope) => Promise<AgentsResponse>
  getAgentSkills: (userId: string) => Promise<AgentSkillsResponse>
  updateAgentSkills: (
    userId: string,
    body: UpdateSkillsRequest,
  ) => Promise<UpdateSkillsResponse>
  getSkillAgents: (skillId: string) => Promise<SkillAgentsResponse>
  getQueues: () => Promise<QueuesResponse>
  getSkills: () => Promise<SkillsResponse>
  getWork: () => Promise<WorkResponse>
  getSnapshot: (scope?: AgentScope) => Promise<SnapshotResponse>
  getRecordDetails: (body: RecordDetailsRequest) => Promise<RecordDetailsResponse>
  /** Loads the running user's saved space plan, or null when none exists. */
  getSpacePlan: () => Promise<SpacePlanData | null>
  /** Full-replace save of the running user's space plan. */
  saveSpacePlan: (plan: SpacePlanData) => Promise<void>
}

type SessionGetter = () => OAuthSession | null | Promise<OAuthSession | null>

function isSessionExpiredMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('invalid_session_id') ||
    normalized.includes('session expired') ||
    normalized.includes('session expired or invalid')
  )
}

export function createMiradorClient(getSession: SessionGetter): MiradorClient {
  async function request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase()

    const session = await getSession()
    if (!session) {
      devLog.api(method, path, '401 not authenticated')
      throw new MiradorApiError('Not authenticated', 401)
    }

    const baseUrl = `${session.instanceUrl.replace(/\/$/, '')}${MIRADOR_API_PATH}`
    const url = `${baseUrl}${path}`
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${session.accessToken}`)
    headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const startedAt = Date.now()
    devLog.api(method, path, 'iniciant…')
    let response: Response
    try {
      response = await fetch(url, { ...init, headers })
    } catch (networkError) {
      const elapsed = Date.now() - startedAt
      devLog.api(method, path, `error de xarxa · ${elapsed}ms`)
      devLog.error(`${method} ${path} → error de xarxa`, networkError)
      throw networkError
    }
    const elapsed = Date.now() - startedAt
    devLog.api(method, path, `${response.status} · ${elapsed}ms`)
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        payload = text
      }
    }

    if (!response.ok) {
      const errorBody = payload as ApiErrorBody | string | null
      const message =
        typeof errorBody === 'object' && errorBody?.error
          ? errorBody.error
          : typeof errorBody === 'string'
            ? errorBody
            : `Request failed with status ${response.status}`

      if (
        retry &&
        (response.status === 401 || isSessionExpiredMessage(message))
      ) {
        devLog.action('auth:session-expired', path)
        const recovered = await recoverAccessSession()
        if (recovered) {
          devLog.action('auth:session-recovered', path)
          return request<T>(path, init, false)
        }
      }

      devLog.error(`${method} ${path} → ${response.status} ${message}`)
      throw new MiradorApiError(
        message,
        response.status,
        typeof errorBody === 'object' && errorBody !== null ? errorBody.path : undefined,
      )
    }

    return payload as T
  }

  return {
    getCapabilities: () => request<Capabilities>('/capabilities'),
    getAgents: (scope = 'connected') =>
      request<AgentsResponse>(`/agents?scope=${encodeURIComponent(scope)}`),
    getAgentSkills: (userId) =>
      request<AgentSkillsResponse>(`/agents/${encodeURIComponent(userId)}/skills`),
    updateAgentSkills: (userId, body) =>
      request<UpdateSkillsResponse>(`/agents/${encodeURIComponent(userId)}/skills`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    getSkillAgents: (skillId) =>
      request<SkillAgentsResponse>(`/skills/${encodeURIComponent(skillId)}/agents`),
    getQueues: () => request<QueuesResponse>('/queues'),
    getSkills: () => request<SkillsResponse>('/skills'),
    getWork: () => request<WorkResponse>('/work'),
    getSnapshot: (scope = 'all') =>
      request<SnapshotResponse>(`/snapshot?scope=${encodeURIComponent(scope)}`),
    getRecordDetails: (body) =>
      request<RecordDetailsResponse>('/records/details', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getSpacePlan: () => request<SpacePlanData | null>('/space-plan'),
    saveSpacePlan: (plan) =>
      request<{ ok: boolean }>('/space-plan', {
        method: 'PUT',
        body: JSON.stringify(plan),
      }).then(() => undefined),
  }
}
