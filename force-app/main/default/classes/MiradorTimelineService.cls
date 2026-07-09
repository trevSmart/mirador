/**
 * One agent's activity for a single day: presence bands + work bars, for the
 * Agent Timeline (Gantt) view. Unlike the snapshot endpoints — which only load
 * the *current* state — this reads the day's history:
 *   - UserServicePresence rows overlapping the day (each status change is a row
 *     with StatusStartDate/StatusEndDate).
 *   - AgentWork rows opened during the day (RequestDateTime → CloseDateTime).
 *
 * Timestamps go out as UTC ISO 8601 (…Z); an open span has end = null and the
 * UI extends it to "now". The JSON shape matches the AgentTimeline type in
 * src/api/types.ts. Response is built as Maps so the keys ('start', 'end', …)
 * are controlled exactly.
 */
public with sharing class MiradorTimelineService {
    private static final Integer MAX_PRESENCE = 500;
    private static final Integer MAX_WORK = 500;

    public static Map<String, Object> getTimeline(Id userId, String dayISO) {
        Date day = parseDay(dayISO);
        Datetime dayStart = Datetime.newInstance(day, Time.newInstance(0, 0, 0, 0));
        Datetime dayEnd = dayStart.addDays(1);

        List<Map<String, Object>> presence = buildPresence(userId, dayStart, dayEnd);
        List<Map<String, Object>> work = buildWork(userId, dayStart, dayEnd);

        Map<String, Object> timeline = new Map<String, Object>{
            'agentId' => String.valueOf(userId),
            // Report the day actually queried (parseDay may resolve blank/invalid
            // input to today), so the payload is self-consistent and honours the
            // frontend's non-null AgentTimeline.day contract.
            'day' => formatDay(day),
            'presence' => presence,
            'work' => work
        };
        return new Map<String, Object>{ 'timeline' => timeline };
    }

    /** Date → 'YYYY-MM-DD' (zero-padded), independent of locale. */
    @TestVisible
    private static String formatDay(Date d) {
        return Datetime.newInstanceGmt(d.year(), d.month(), d.day(), 0, 0, 0)
            .formatGmt('yyyy-MM-dd');
    }

    private static Date parseDay(String dayISO) {
        if (String.isBlank(dayISO)) {
            return System.today();
        }
        try {
            return Date.valueOf(dayISO);
        } catch (Exception ex) {
            return System.today();
        }
    }

    private static List<Map<String, Object>> buildPresence(
        Id userId, Datetime dayStart, Datetime dayEnd
    ) {
        List<Map<String, Object>> bands = new List<Map<String, Object>>();
        for (UserServicePresence usp : [
            SELECT Id, StatusStartDate, StatusEndDate,
                   ServicePresenceStatus.MasterLabel,
                   ServicePresenceStatus.DeveloperName
            FROM UserServicePresence
            WHERE UserId = :userId
              AND StatusStartDate < :dayEnd
              AND (StatusEndDate = null OR StatusEndDate >= :dayStart)
            ORDER BY StatusStartDate ASC
            LIMIT :MAX_PRESENCE
        ]) {
            String label = usp.ServicePresenceStatus?.MasterLabel;
            String status = MiradorAgentService.mapPresenceStatus(
                usp.ServicePresenceStatus?.DeveloperName, label
            );
            bands.add(new Map<String, Object>{
                'id' => String.valueOf(usp.Id),
                'start' => isoUtc(usp.StatusStartDate),
                'end' => isoUtc(usp.StatusEndDate),
                'label' => label,
                'status' => status,
                'presenceLabel' => label
            });
        }
        return bands;
    }

    private static List<Map<String, Object>> buildWork(
        Id userId, Datetime dayStart, Datetime dayEnd
    ) {
        List<AgentWork> rows = [
            SELECT Id, WorkItemId, RequestDateTime, CloseDateTime,
                   OriginalQueueId,
                   ServiceChannel.MasterLabel, ServiceChannel.DeveloperName
            FROM AgentWork
            WHERE UserId = :userId
              AND RequestDateTime < :dayEnd
              AND (CloseDateTime = null OR CloseDateTime >= :dayStart)
            ORDER BY RequestDateTime ASC
            LIMIT :MAX_WORK
        ];

        Set<Id> caseIds = new Set<Id>();
        Set<Id> queueIds = new Set<Id>();
        for (AgentWork aw : rows) {
            if (aw.WorkItemId != null && String.valueOf(aw.WorkItemId).startsWith('500')) {
                caseIds.add(aw.WorkItemId);
            }
            if (aw.OriginalQueueId != null) {
                queueIds.add(aw.OriginalQueueId);
            }
        }
        Map<Id, Case> casesById = caseIds.isEmpty()
            ? new Map<Id, Case>()
            : new Map<Id, Case>([SELECT Id, CaseNumber, Subject FROM Case WHERE Id IN :caseIds]);
        Map<Id, Group> queuesById = queueIds.isEmpty()
            ? new Map<Id, Group>()
            : new Map<Id, Group>([SELECT Id, Name FROM Group WHERE Id IN :queueIds]);

        List<Map<String, Object>> bars = new List<Map<String, Object>>();
        for (AgentWork aw : rows) {
            String channelLabel = aw.ServiceChannel?.MasterLabel;
            String channelKey = MiradorAgentService.mapChannelKey(
                aw.ServiceChannel?.DeveloperName, channelLabel
            );
            String queueName = aw.OriginalQueueId != null && queuesById.containsKey(aw.OriginalQueueId)
                ? queuesById.get(aw.OriginalQueueId).Name
                : null;
            bars.add(new Map<String, Object>{
                'id' => String.valueOf(aw.Id),
                'start' => isoUtc(aw.RequestDateTime),
                'end' => isoUtc(aw.CloseDateTime),
                'label' => subjectFor(aw.WorkItemId, casesById, channelLabel),
                'channelKey' => channelKey,
                'recordId' => aw.WorkItemId == null ? null : String.valueOf(aw.WorkItemId),
                'queue' => queueName
            });
        }
        return bars;
    }

    private static String subjectFor(Id workItemId, Map<Id, Case> casesById, String channelLabel) {
        if (workItemId != null && casesById.containsKey(workItemId)) {
            Case c = casesById.get(workItemId);
            if (!String.isBlank(c.Subject)) {
                return c.Subject;
            }
            return c.CaseNumber;
        }
        return String.isBlank(channelLabel) ? 'Work item' : channelLabel;
    }

    /** Datetime → UTC ISO 8601 (…Z), or null. Matches JS Date.parse on the client. */
    @TestVisible
    private static String isoUtc(Datetime dt) {
        return dt == null ? null : dt.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');
    }
}
