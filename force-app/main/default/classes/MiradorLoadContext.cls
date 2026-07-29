/**
 * Shared Omni-Channel data loaded once per API transaction. Used by /snapshot
 * and the individual domain endpoints to avoid duplicate SOQL.
 */
public with sharing class MiradorLoadContext {
    public final Map<Id, UserServicePresence> presenceByUser;
    public final List<AgentWork> activeAgentWork;
    public final List<PendingServiceRouting> pendingRouting;
    public final Map<Id, Case> casesById;
    public final Map<Id, MessagingSession> messagingSessionsById;
    public final Map<Id, Group> queuesById;
    public final Datetime loadedAt;

    private MiradorLoadContext(
        Map<Id, UserServicePresence> presenceByUser,
        List<AgentWork> activeAgentWork,
        List<PendingServiceRouting> pendingRouting,
        Map<Id, Case> casesById,
        Map<Id, MessagingSession> messagingSessionsById,
        Map<Id, Group> queuesById,
        Datetime loadedAt
    ) {
        this.presenceByUser = presenceByUser;
        this.activeAgentWork = activeAgentWork;
        this.pendingRouting = pendingRouting;
        this.casesById = casesById;
        this.messagingSessionsById = messagingSessionsById;
        this.queuesById = queuesById;
        this.loadedAt = loadedAt;
    }

    public static MiradorLoadContext load() {
        Datetime nowDt = System.now();
        Map<Id, UserServicePresence> presence = loadPresence();
        List<AgentWork> agentWork = loadActiveAgentWork();
        List<PendingServiceRouting> pending = loadPendingRouting();

        Set<Id> caseIds = new Set<Id>();
        Set<Id> messagingSessionIds = new Set<Id>();
        Set<Id> queueNameIds = new Set<Id>();
        collectWorkItemAndQueueIds(
            agentWork, pending, caseIds, messagingSessionIds, queueNameIds
        );

        Map<Id, Case> cases = loadCases(caseIds);
        Map<Id, MessagingSession> messagingSessions = loadMessagingSessions(messagingSessionIds);
        Map<Id, Group> queues = loadQueueNames(queueNameIds);

        return new MiradorLoadContext(
            presence, agentWork, pending, cases, messagingSessions, queues, nowDt
        );
    }

    /** Ids of PSR rows already filtered to IsReadyForRouting = true. */
    public Set<Id> readyPsrIds() {
        Set<Id> ids = new Set<Id>();
        for (PendingServiceRouting psr : pendingRouting) {
            if (psr.Id != null) {
                ids.add(psr.Id);
            }
        }
        return ids;
    }

    /** Backing records (Case, MessagingSession, …) with active AgentWork. */
    public Set<Id> assignedWorkItemIds() {
        Set<Id> ids = new Set<Id>();
        for (AgentWork aw : activeAgentWork) {
            if (aw.WorkItemId != null) {
                ids.add(aw.WorkItemId);
            }
        }
        return ids;
    }

    private static Map<Id, UserServicePresence> loadPresence() {
        Map<Id, UserServicePresence> presenceByUser = new Map<Id, UserServicePresence>();
        for (UserServicePresence usp : [
            SELECT UserId, ServicePresenceStatusId,
                   ServicePresenceStatus.MasterLabel,
                   ServicePresenceStatus.DeveloperName,
                   StatusStartDate, ConfiguredCapacity
            FROM UserServicePresence
            WHERE IsCurrentState = true
            LIMIT 500
        ]) {
            presenceByUser.put(usp.UserId, usp);
        }
        return presenceByUser;
    }

    private static List<AgentWork> loadActiveAgentWork() {
        return [
            SELECT Id, UserId, WorkItemId, Status,
                   ServiceChannel.MasterLabel, ServiceChannel.DeveloperName,
                   RequestDateTime, OriginalQueueId
            FROM AgentWork
            WHERE Status IN ('Opened', 'Assigned', 'Accepted')
            ORDER BY RequestDateTime DESC
            LIMIT 2000
        ];
    }

    private static List<PendingServiceRouting> loadPendingRouting() {
        return [
            SELECT Id, WorkItemId, QueueId, CreatedDate,
                   ServiceChannel.MasterLabel, ServiceChannel.DeveloperName
            FROM PendingServiceRouting
            WHERE IsReadyForRouting = true
            ORDER BY CreatedDate ASC
            LIMIT 10000
        ];
    }

    private static void collectWorkItemAndQueueIds(
        List<AgentWork> agentWork,
        List<PendingServiceRouting> pending,
        Set<Id> caseIds,
        Set<Id> messagingSessionIds,
        Set<Id> queueNameIds
    ) {
        for (AgentWork aw : agentWork) {
            addWorkItemId(aw.WorkItemId, caseIds, messagingSessionIds);
            if (aw.OriginalQueueId != null) {
                queueNameIds.add(aw.OriginalQueueId);
            }
        }
        for (PendingServiceRouting psr : pending) {
            addWorkItemId(psr.WorkItemId, caseIds, messagingSessionIds);
        }
    }

    private static void addWorkItemId(
        Id workItemId,
        Set<Id> caseIds,
        Set<Id> messagingSessionIds
    ) {
        if (workItemId == null) {
            return;
        }
        String raw = String.valueOf(workItemId);
        if (raw.startsWith('500')) {
            caseIds.add(workItemId);
        } else if (raw.startsWith('0Mw')) {
            messagingSessionIds.add(workItemId);
        }
    }

    private static Map<Id, Case> loadCases(Set<Id> caseIds) {
        if (caseIds.isEmpty()) {
            return new Map<Id, Case>();
        }
        return new Map<Id, Case>([
            SELECT Id, CaseNumber, Subject
            FROM Case
            WHERE Id IN :caseIds
        ]);
    }

    private static Map<Id, MessagingSession> loadMessagingSessions(Set<Id> sessionIds) {
        if (sessionIds.isEmpty()) {
            return new Map<Id, MessagingSession>();
        }
        if (!Schema.sObjectType.MessagingSession.isAccessible()) {
            return new Map<Id, MessagingSession>();
        }
        return new Map<Id, MessagingSession>([
            SELECT Id, Name, PreviewDetails, MessagingEndUser.Name
            FROM MessagingSession
            WHERE Id IN :sessionIds
        ]);
    }

    private static Map<Id, Group> loadQueueNames(Set<Id> queueIds) {
        if (queueIds.isEmpty()) {
            return new Map<Id, Group>();
        }
        return new Map<Id, Group>([
            SELECT Id, Name
            FROM Group
            WHERE Id IN :queueIds
        ]);
    }
}
