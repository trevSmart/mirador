import { useQuery } from '@tanstack/react-query'
import { usePreferences } from '../../settings/preferences-context'
import type { MessagingTranscript } from '../types'
import { isLiveMessagingSession } from '../../utils/messaging'
import { entityKey } from './query-keys'
import { messagingTranscriptResource } from './resources/messaging-transcript'
import { useSourceClient } from './sources'

export interface UseMessagingTranscriptOptions {
  recordStatus?: string | null
  conversationIdentifier?: string | null
}

export function useMessagingTranscript(
  sessionId: string | null | undefined,
  options: UseMessagingTranscriptOptions,
) {
  const client = useSourceClient('salesforce')
  const { prefs } = usePreferences()
  const enabled = client !== null && !!sessionId?.startsWith('0Mw')

  return useQuery<MessagingTranscript>({
    queryKey: entityKey('salesforce', messagingTranscriptResource.entity, sessionId),
    queryFn: () =>
      client!.getMessagingTranscript(sessionId!, {
        conversationIdentifier: options.conversationIdentifier ?? undefined,
      }),
    enabled,
    staleTime: messagingTranscriptResource.staleTime,
    refetchInterval: (query) => {
      if (!enabled || !prefs.autoRefresh) return false
      const live = isLiveMessagingSession(
        query.state.data?.sessionStatus,
        options.recordStatus,
      )
      return live ? prefs.refreshInterval * 1000 : false
    },
    refetchIntervalInBackground: false,
    refetchOnMount: true,
  })
}
