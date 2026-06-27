import { describe, expect, it } from 'vitest'
import { entityKey, entityListKey } from './query-keys'

describe('query-keys', () => {
  it('namespaces a key by source, entity and params', () => {
    expect(entityKey('salesforce', 'recordDetail', '500x')).toEqual([
      'salesforce',
      'recordDetail',
      '500x',
    ])
  })

  it('builds an entity prefix key for invalidation', () => {
    expect(entityListKey('salesforce', 'recordDetail')).toEqual([
      'salesforce',
      'recordDetail',
    ])
  })

  it('produces structurally equal keys for equal inputs', () => {
    expect(entityKey('salesforce', 'recordDetail', 'a')).toEqual(
      entityKey('salesforce', 'recordDetail', 'a'),
    )
  })
})
