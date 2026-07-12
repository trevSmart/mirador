import {
  agentResource,
  queueResource,
  recordDetailResource,
  useEntity,
} from '../../api/data-service'
import { MiradorApiError } from '../../api/mirador-client'
import type { WorkItem } from '../../api/types'
import { useAuth } from '../../auth/auth-context'
import { useDetailDrawer } from '../../detail/detail-drawer-context'
import { colorFromRecordId } from '../../utils/color-from-string'
import {
  channelLabel,
  formatDateTime,
  formatSeconds,
  recordStatusLabel,
  recordStatusTone,
  workStatusLabel,
} from '../../utils/format'
import { objectLabel, resolveWorkItemIcon } from '../../utils/salesforce-object-icon'
import { AppIcon, Badge, FadeValue, SfIcon } from '../ds'
import { DetailRow, DrawerActions, DrawerSection, EmptyHint, MiniAgentRow, Stat, StatGrid } from './parts'

/* Generic work-item detail. Shows what the global /work snapshot already gives
   us (subject, channel, status, age, backing SObject, related agent/queue).
   A type-specific endpoint per SObject (VoiceCall, Case, …) will enrich this
   later — see the placeholder section below. */
export function WorkItemDetail({ item }: { item: WorkItem }) {
  const { openAgent, openQueue } = useDetailDrawer()
  const { session } = useAuth()

  // Link to the backing record in Salesforce, same shape the server uses for
  // agents (org URL + record id redirect). Absent in mock mode (no session).
  const recordUrl =
    session?.instanceUrl && item.workItemId
      ? `${session.instanceUrl.replace(/\/$/, '')}/${item.workItemId}`
      : null

  const icon = resolveWorkItemIcon(item)
  // L'agent i la cua relacionats surten de la caché per-id (ja primada pel
  // snapshot): així aquest detall no es re-renderitza quan canvia qualsevol
  // altre agent, només el seu.
  const agent = useEntity(agentResource, item.agentId ?? null).data ?? undefined
  const queue = useEntity(queueResource, item.queueId ?? null).data ?? undefined

  // Reads through the Data Service cache: reopening the same work item (or two
  // items sharing a record) reuses the cached detail instead of refetching, and
  // concurrent opens coalesce into a single /records/details call.
  const recordQuery = useEntity(recordDetailResource, item.workItemId)
  const detail = recordQuery.data ?? null
  const recordStatus = detail ? recordStatusLabel(detail) : null
  const isLoading = recordQuery.isLoading
  const error =
    recordQuery.isError && recordQuery.data === undefined
      ? recordQuery.error instanceof MiradorApiError
        ? recordQuery.error.message
        : 'No s\'han pogut carregar els detalls del registre'
      : null

  return (
    <>
      <header className="dd-head">
        <SfIcon sprite={icon.sprite} symbol={icon.symbol} size={56} recordId={item.id} />
        <div className="dd-head__id">
          <h2 className="dd-head__name" style={{ color: colorFromRecordId(item.id) }}>
            {item.subject}
          </h2>
          <span className="dd-head__sub">{objectLabel(item)}</span>
          <Badge tone="neutral">{workStatusLabel(item.status)}</Badge>
          {recordStatus ? (
            <Badge tone={recordStatusTone(detail!)}>{recordStatus}</Badge>
          ) : null}
        </div>
      </header>

      <DrawerActions
        actions={[
          { label: 'Encamina', icon: 'arrow-right', primary: true },
          { label: 'Escala', icon: 'notification' },
        ]}
      />

      {recordUrl ? (
        <div className="dd-actions">
          <a className="dd-action" href={recordUrl} target="_blank" rel="noreferrer">
            <AppIcon name="new_window" size={15} />
            Obre a Salesforce
          </a>
        </div>
      ) : null}

      <DrawerSection title="Resum">
        <StatGrid>
          <Stat label="Canal" value={channelLabel(item.channelKey)} />
          <Stat label="Estat" value={workStatusLabel(item.status)} />
          {recordStatus ? <Stat label="Estat del registre" value={recordStatus} /> : null}
          <Stat label="Edat" value={<FadeValue value={formatSeconds(item.ageSec)} />} />
          <Stat label="Tipus d'objecte" value={objectLabel(item)} />
        </StatGrid>
      </DrawerSection>

      <DrawerSection title="Relacionats">
        {agent || queue ? (
          <div className="dd-list">
            {agent ? <MiniAgentRow agent={agent} onClick={() => openAgent(agent.id)} /> : null}
            {queue ? (
              <DetailRow
                leading={<SfIcon name="queue" sldsSize="small" recordId={queue.id} />}
                title={queue.name}
                recordId={queue.id}
                meta="Cua"
                onClick={() => openQueue(queue.id)}
              />
            ) : null}
          </div>
        ) : (
          <EmptyHint>Sense agent ni cua associats.</EmptyHint>
        )}
      </DrawerSection>

      <DrawerSection title="Detalls">
        {!item.workItemId ? (
          <EmptyHint>Sense registre associat.</EmptyHint>
        ) : isLoading ? (
          <EmptyHint>Carregant…</EmptyHint>
        ) : error ? (
          <EmptyHint>{error}</EmptyHint>
        ) : detail ? (
          <StatGrid>
            <Stat label="Creat" value={formatDateTime(detail.createdDate)} />
            <Stat label="Modificat" value={formatDateTime(detail.lastModifiedDate)} />
            {detail.caseNumber ? <Stat label="Número de cas" value={detail.caseNumber} /> : null}
            {detail.subject && detail.subject !== item.subject ? (
              <Stat label="Assumpte" value={detail.subject} />
            ) : null}
          </StatGrid>
        ) : (
          <EmptyHint>No s&apos;han trobat detalls del registre.</EmptyHint>
        )}
      </DrawerSection>
    </>
  )
}
