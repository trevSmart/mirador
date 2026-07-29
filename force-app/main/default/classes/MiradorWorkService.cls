/**
 * Work items currently traveling through queues to agents. Combines two sources:
 *   - AgentWork rows in an active status are items already assigned to an agent.
 *   - PendingServiceRouting rows ready for routing are items still in their queue.
 * The merged shape mirrors what the Work page (src/data/normalize.js
 * normalizeWorkRecord) and the Salesforce data provider's /work fetch expect.
 */
public with sharing class MiradorWorkService {
    public class WorkItemDto {
        public String id;
        public String workItemId;
        public String objectApiName;
        /** Lightning icon name, e.g. standard:case or custom:custom78 */
        public String iconName;
        public String iconSprite;
        public String iconSymbol;
        public String subject;
        public String channelKey;
        public String queueId;
        public String agentId;
        public String status; // 'assigned' | 'queued'
        public Integer ageSec;
    }

    public class WorkResponse {
        public List<WorkItemDto> work;
    }

    public static WorkResponse getWork() {
        MiradorLoadContext ctx = MiradorLoadContext.load();
        WorkResponse response = new WorkResponse();
        response.work = buildWorkFromContext(ctx);
        return response;
    }

    public static List<WorkItemDto> buildWorkFromContext(MiradorLoadContext ctx) {
        List<WorkItemDto> work = new List<WorkItemDto>();

        Set<Id> assignedWorkItemIds = ctx.assignedWorkItemIds();
        List<PendingServiceRouting> pendingForWork = pendingForWorkExcludingAssigned(
            ctx.pendingRouting, assignedWorkItemIds, 2000
        );

        Set<Id> workItemIds = collectWorkItemIds(ctx.activeAgentWork, pendingForWork);
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName =
            MiradorObjectIconUtil.forWorkItemIds(workItemIds);

        work.addAll(buildAssignedItems(
            ctx.activeAgentWork,
            ctx.casesById,
            ctx.messagingSessionsById,
            ctx.loadedAt,
            iconsByApiName
        ));
        work.addAll(buildQueuedItems(
            pendingForWork,
            ctx.casesById,
            ctx.messagingSessionsById,
            ctx.loadedAt,
            iconsByApiName
        ));
        return work;
    }

    @TestVisible
    private static Set<Id> collectWorkItemIds(
        List<AgentWork> assigned, List<PendingServiceRouting> pending
    ) {
        Set<Id> workItemIds = new Set<Id>();
        for (AgentWork aw : assigned) {
            if (aw.WorkItemId != null) {
                workItemIds.add(aw.WorkItemId);
            }
        }
        for (PendingServiceRouting psr : pending) {
            if (psr.WorkItemId != null) {
                workItemIds.add(psr.WorkItemId);
            }
        }
        return workItemIds;
    }

    @TestVisible
    private static List<PendingServiceRouting> pendingForWorkExcludingAssigned(
        List<PendingServiceRouting> pending,
        Set<Id> assignedWorkItemIds,
        Integer maxRows
    ) {
        List<PendingServiceRouting> result = new List<PendingServiceRouting>();
        Integer rowLimit = maxRows == null || maxRows < 1 ? pending.size() : maxRows;
        for (Integer i = 0; i < pending.size() && i < rowLimit; i++) {
            PendingServiceRouting psr = pending[i];
            // Omni can keep a ready PSR row while AgentWork is active; show assigned only.
            if (psr.WorkItemId != null && assignedWorkItemIds.contains(psr.WorkItemId)) {
                continue;
            }
            result.add(psr);
        }
        return result;
    }

    /**
     * Map active AgentWork rows to assigned work items. Pure over its inputs (no
     * SOQL) so it stays unit-testable; AgentWork cannot be inserted in tests.
     */
    @TestVisible
    private static List<WorkItemDto> buildAssignedItems(
        List<AgentWork> assigned,
        Map<Id, Case> caseById,
        Map<Id, MessagingSession> messagingById,
        Datetime nowDt,
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName
    ) {
        List<WorkItemDto> items = new List<WorkItemDto>();
        for (AgentWork aw : assigned) {
            WorkItemDto dto = new WorkItemDto();
            dto.id = String.valueOf(aw.Id);
            dto.channelKey = MiradorAgentService.mapChannelKey(
                aw.ServiceChannel?.DeveloperName, aw.ServiceChannel?.MasterLabel);
            dto.queueId = aw.OriginalQueueId == null ? null : String.valueOf(aw.OriginalQueueId);
            dto.agentId = aw.UserId == null ? null : String.valueOf(aw.UserId);
            dto.status = 'assigned';
            dto.ageSec = secondsSince(nowDt, aw.RequestDateTime);
            dto.workItemId = aw.WorkItemId == null ? null : String.valueOf(aw.WorkItemId);
            applyObjectIcon(dto, aw.WorkItemId, iconsByApiName);
            dto.subject = subjectFor(
                aw.WorkItemId, caseById, messagingById, aw.ServiceChannel?.MasterLabel
            );
            items.add(dto);
        }
        return items;
    }

    /**
     * Map ready PendingServiceRouting rows to queued work items. Pure over its
     * inputs (no SOQL) so it stays unit-testable; PendingServiceRouting cannot be
     * inserted in tests.
     */
    @TestVisible
    private static List<WorkItemDto> buildQueuedItems(
        List<PendingServiceRouting> pending,
        Map<Id, Case> caseById,
        Map<Id, MessagingSession> messagingById,
        Datetime nowDt,
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName
    ) {
        List<WorkItemDto> items = new List<WorkItemDto>();
        for (PendingServiceRouting psr : pending) {
            WorkItemDto dto = new WorkItemDto();
            dto.id = String.valueOf(psr.Id);
            dto.channelKey = MiradorAgentService.mapChannelKey(
                psr.ServiceChannel?.DeveloperName, psr.ServiceChannel?.MasterLabel);
            dto.queueId = psr.QueueId == null ? null : String.valueOf(psr.QueueId);
            dto.agentId = null;
            dto.status = 'queued';
            dto.ageSec = secondsSince(nowDt, psr.CreatedDate);
            dto.workItemId = psr.WorkItemId == null ? null : String.valueOf(psr.WorkItemId);
            applyObjectIcon(dto, psr.WorkItemId, iconsByApiName);
            dto.subject = subjectFor(
                psr.WorkItemId, caseById, messagingById, psr.ServiceChannel?.MasterLabel
            );
            items.add(dto);
        }
        return items;
    }

    @TestVisible
    private static void applyObjectIcon(
        WorkItemDto dto,
        Id workItemId,
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName
    ) {
        MiradorObjectIconUtil.IconDescriptor icon;
        if (workItemId == null) {
            icon = MiradorObjectIconUtil.forRecord(null);
        } else {
            Schema.SObjectType soType = workItemId.getSObjectType();
            String apiName = soType == null ? null : soType.getDescribe().getName();
            icon = apiName != null && iconsByApiName.containsKey(apiName)
                ? iconsByApiName.get(apiName)
                : MiradorObjectIconUtil.forRecord(workItemId);
        }
        dto.objectApiName = icon.objectApiName;
        dto.iconName = icon.iconName;
        dto.iconSprite = icon.sprite;
        dto.iconSymbol = icon.symbol;
    }

    @TestVisible
    private static Boolean isCaseId(Id workItemId) {
        return workItemId != null && String.valueOf(workItemId).startsWith('500');
    }

    @TestVisible
    private static String subjectFor(
        Id workItemId,
        Map<Id, Case> caseById,
        Map<Id, MessagingSession> messagingById,
        String channelLabel
    ) {
        if (workItemId != null && caseById != null && caseById.containsKey(workItemId)) {
            Case c = caseById.get(workItemId);
            if (!String.isBlank(c.Subject)) {
                return c.Subject;
            }
            return c.CaseNumber;
        }
        if (workItemId != null && messagingById != null && messagingById.containsKey(workItemId)) {
            return messagingSubject(messagingById.get(workItemId), channelLabel);
        }
        return String.isBlank(channelLabel) ? 'Work item' : channelLabel;
    }

    @TestVisible
    public static String messagingSubject(MessagingSession ms, String channelLabel) {
        if (ms == null) {
            return String.isBlank(channelLabel) ? 'Work item' : channelLabel;
        }
        if (!String.isBlank(ms.Name)) {
            return ms.Name;
        }
        if (ms.MessagingEndUser != null && !String.isBlank(ms.MessagingEndUser.Name)) {
            return ms.MessagingEndUser.Name;
        }
        if (!String.isBlank(ms.PreviewDetails)) {
            return ms.PreviewDetails;
        }
        return String.isBlank(channelLabel) ? 'Work item' : channelLabel;
    }

    @TestVisible
    private static Integer secondsSince(Datetime nowDt, Datetime startedAt) {
        if (startedAt == null) {
            return 0;
        }
        Long diff = (nowDt.getTime() - startedAt.getTime()) / 1000;
        return diff < 0 ? 0 : Integer.valueOf(diff);
    }
}