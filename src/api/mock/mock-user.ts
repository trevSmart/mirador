import supervisorAvatar from './avatars/m3.jpg'
import type { SalesforceUserInfo } from '../../auth/types'

const MOCK_SUPERVISOR = {
  name: 'Marc Ribera',
  title: 'Operations Supervisor',
} as const

export const MOCK_USER_INFO: SalesforceUserInfo = {
  sub: 'mock-supervisor',
  user_id: 'mock-supervisor',
  organization_id: 'mock-org',
  name: MOCK_SUPERVISOR.name,
  email: 'supervisor@mock.local',
  picture: supervisorAvatar,
}
