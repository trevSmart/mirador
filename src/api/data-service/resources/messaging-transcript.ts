import type { MessagingTranscript } from '../../types'
import { defineResource } from '../resource'

export const messagingTranscriptResource = defineResource<
  'salesforce',
  string,
  MessagingTranscript
>({
  source: 'salesforce',
  entity: 'messagingTranscript',
  staleTime: 5_000,
  keyOf: (sessionId) => sessionId,
  fetch: async (client, sessionId) => client.getMessagingTranscript(sessionId),
})
