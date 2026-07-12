import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { primeEntities, pruneEntities } from './prime'
import { entityKey } from './query-keys'
import { defineResource } from './resource'

interface Doc {
  ref: string
  title: string
}

/* Resource amb un `keyOf` que NO és la identitat: els params són un objecte i la
   clau de caché n'és una serialització. És el cas que distingeix una poda
   correcta d'una que compara params crus contra claus serialitzades. */
const docResource = defineResource<'salesforce', { ref: string }, Doc | null>({
  source: 'salesforce',
  entity: 'doc',
  keyOf: (params) => `doc:${params.ref}`,
  fetch: async () => null,
})

describe('pruneEntities', () => {
  it('normalitza `keep` amb el keyOf del resource, no compara params crus', () => {
    const queryClient = new QueryClient()
    primeEntities(queryClient, docResource, [
      { params: { ref: 'a' }, data: { ref: 'a', title: 'A' } },
      { params: { ref: 'b' }, data: { ref: 'b', title: 'B' } },
    ])

    // 'a' segueix al payload, 'b' no.
    pruneEntities(queryClient, docResource, [{ ref: 'a' }])

    expect(
      queryClient.getQueryData(entityKey('salesforce', 'doc', 'doc:a')),
    ).toEqual({ ref: 'a', title: 'A' })
    expect(
      queryClient.getQueryData(entityKey('salesforce', 'doc', 'doc:b')),
    ).toBeNull()
  })

  it('no toca les entrades d\'altres entitats', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(entityKey('salesforce', 'agent', 'doc:a'), {
      id: 'doc:a',
    })

    pruneEntities(queryClient, docResource, [])

    expect(
      queryClient.getQueryData(entityKey('salesforce', 'agent', 'doc:a')),
    ).toEqual({ id: 'doc:a' })
  })
})
