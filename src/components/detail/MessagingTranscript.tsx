import { useEffect, useMemo, useRef } from 'react'
import { useMessagingTranscript } from '../../api/data-service'
import { useAgents } from '../../api/data-hooks'
import { MiradorApiError } from '../../api/mirador-client'
import {
  formatMessagingTime,
  isLiveMessagingSession,
  senderLabel,
} from '../../utils/messaging'
import { DrawerSection, EmptyHint } from './parts'

export interface MessagingTranscriptProps {
  sessionId: string
  recordStatus?: string | null
  conversationIdentifier?: string | null
  endUserName?: string | null
}

export function MessagingTranscript({
  sessionId,
  recordStatus,
  conversationIdentifier,
  endUserName,
}: MessagingTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const agents = useAgents()

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  const transcriptQuery = useMessagingTranscript(sessionId, {
    recordStatus,
    conversationIdentifier,
  })

  const transcript = transcriptQuery.data
  const liveResolved = isLiveMessagingSession(
    transcript?.sessionStatus,
    recordStatus,
  )

  const entries = transcript?.entries ?? []
  const resolvedEndUserName = transcript?.endUserName ?? endUserName

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const grew = entries.length > prevCountRef.current
    prevCountRef.current = entries.length
    if (!grew || entries.length === 0) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 48) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries.length])

  const error =
    transcriptQuery.isError && transcriptQuery.data === undefined
      ? transcriptQuery.error instanceof MiradorApiError
        ? transcriptQuery.error.message
        : 'No s\'ha pogut carregar la conversa'
      : null

  return (
    <DrawerSection title="Conversa" compact>
      {transcriptQuery.isLoading && entries.length === 0 ? (
        <EmptyHint>Carregant conversa…</EmptyHint>
      ) : error ? (
        <EmptyHint>{error}</EmptyHint>
      ) : entries.length === 0 ? (
        <EmptyHint>Encara no hi ha missatges.</EmptyHint>
      ) : (
        <div
          ref={scrollRef}
          className="msg-transcript"
          aria-live={liveResolved ? 'polite' : undefined}
        >
          {entries.map((entry) => {
            const isEndUser = entry.senderRole === 'EndUser'
            const label = senderLabel(entry, {
              endUserName: resolvedEndUserName,
              agentNameById,
            })
            const time = formatMessagingTime(entry.clientTimestamp)
            return (
              <div
                key={entry.identifier}
                className={`msg-transcript__row${isEndUser ? ' msg-transcript__row--end-user' : ' msg-transcript__row--agent'}`}
              >
                <div className="msg-transcript__bubble">
                  <div className="msg-transcript__meta">
                    <span className="msg-transcript__sender">{label}</span>
                    {time ? <span className="msg-transcript__time">{time}</span> : null}
                  </div>
                  <p className="msg-transcript__text">{entry.messageText}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DrawerSection>
  )
}
