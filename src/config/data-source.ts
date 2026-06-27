import type { PublicOAuthConfig } from '../auth/types'

type DataSource = 'mock' | 'salesforce'

function getDataSource(config: PublicOAuthConfig | null): DataSource {
  if (config?.dataSource === 'mock' || config?.dataSource === 'salesforce') {
    return config.dataSource
  }
  return 'salesforce'
}

export function isMockMode(config: PublicOAuthConfig | null): boolean {
  return getDataSource(config) === 'mock'
}
