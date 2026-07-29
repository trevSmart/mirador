/**
 * Batch record-detail lookup for arbitrary SObject ids. Given a list of record
 * ids (e.g. the workItemId behind a work item), returns the common audit fields
 * (CreatedDate, LastModifiedDate) for every record, plus a few type-specific
 * fields when the record's type supports them:
 *   - Case            → CaseNumber, Subject, Status, IsClosed
 *   - MessagingSession → PreviewDetails/Name, ConversationIdentifier, MessagingEndUser.Name
 *
 * The lookup is generic: ids are grouped by SObjectType and queried one SOQL per
 * type. Unknown or non-queryable types simply return the common fields. Specific
 * fields are only added to the query when the type actually declares them, so the
 * service stays robust as new work-item-backing objects appear.
 */
public with sharing class MiradorRecordDetailsService {
    /** Hard cap on ids processed per call, aligned with SOQL/governor limits. */
    private static final Integer MAX_IDS = 200;

    public class RecordDetailDto {
        public String id;
        public String objectApiName;
        public Datetime createdDate;
        public Datetime lastModifiedDate;
        public String caseNumber; // només Case
        public String subject; // Case / MessagingSession
        public String recordStatus; // Case.Status (i altres tipus amb Status, futur)
        public Boolean recordClosed; // Case.IsClosed
        public String conversationIdentifier; // MessagingSession → Conversation
        public String endUserName; // MessagingSession → MessagingEndUser.Name
    }

    public class RecordDetailsResponse {
        public List<RecordDetailDto> records;
    }

    public class RecordDetailsException extends Exception {}

    public static RecordDetailsResponse getRecordDetails(List<Id> recordIds) {
        RecordDetailsResponse response = new RecordDetailsResponse();
        response.records = new List<RecordDetailDto>();

        if (recordIds == null || recordIds.isEmpty()) {
            return response;
        }

        // Group the (deduplicated, capped) ids by their object API name.
        Map<String, Set<Id>> idsByType = groupIdsByType(recordIds);

        for (String apiName : idsByType.keySet()) {
            if (apiName == 'MessagingSession') {
                response.records.addAll(queryMessagingSessions(idsByType.get(apiName)));
            } else {
                response.records.addAll(queryType(apiName, idsByType.get(apiName)));
            }
        }
        return response;
    }

    @TestVisible
    private static Map<String, Set<Id>> groupIdsByType(List<Id> recordIds) {
        Map<String, Set<Id>> idsByType = new Map<String, Set<Id>>();
        Set<Id> seen = new Set<Id>();
        for (Id recordId : recordIds) {
            if (recordId == null || seen.contains(recordId) || seen.size() >= MAX_IDS) {
                continue;
            }
            seen.add(recordId);
            Schema.SObjectType soType = recordId.getSObjectType();
            if (soType == null) {
                continue;
            }
            String apiName = soType.getDescribe().getName();
            if (!idsByType.containsKey(apiName)) {
                idsByType.put(apiName, new Set<Id>());
            }
            idsByType.get(apiName).add(recordId);
        }
        return idsByType;
    }

    private static List<RecordDetailDto> queryMessagingSessions(Set<Id> ids) {
        List<RecordDetailDto> result = new List<RecordDetailDto>();
        if (ids == null || ids.isEmpty()) {
            return result;
        }
        if (!Schema.sObjectType.MessagingSession.isAccessible()) {
            return result;
        }
        for (MessagingSession ms : [
            SELECT Id, CreatedDate, LastModifiedDate, Status, Name, PreviewDetails,
                   Conversation.ConversationIdentifier,
                   MessagingEndUser.Name
            FROM MessagingSession
            WHERE Id IN :ids
            WITH SECURITY_ENFORCED
        ]) {
            RecordDetailDto dto = new RecordDetailDto();
            dto.id = String.valueOf(ms.Id);
            dto.objectApiName = 'MessagingSession';
            dto.createdDate = ms.CreatedDate;
            dto.lastModifiedDate = ms.LastModifiedDate;
            dto.subject = String.isBlank(ms.PreviewDetails) ? ms.Name : ms.PreviewDetails;
            dto.recordStatus = ms.Status;
            dto.conversationIdentifier = ms.Conversation == null
                ? null
                : ms.Conversation.ConversationIdentifier;
            dto.endUserName = ms.MessagingEndUser == null ? null : ms.MessagingEndUser.Name;
            result.add(dto);
        }
        return result;
    }

    private static List<RecordDetailDto> queryType(String apiName, Set<Id> ids) {
        List<RecordDetailDto> result = new List<RecordDetailDto>();

        Schema.DescribeSObjectResult describe = describeFor(apiName);
        if (describe == null || !describe.isQueryable() || !describe.isAccessible()) {
            return result;
        }

        Map<String, Schema.SObjectField> fields = describe.fields.getMap();
        Boolean hasCaseNumber = fields.containsKey('casenumber');
        Boolean hasSubject = fields.containsKey('subject');
        Boolean hasStatus = fields.containsKey('status');
        Boolean hasIsClosed = fields.containsKey('isclosed');

        List<String> selectFields = new List<String>{ 'Id', 'CreatedDate', 'LastModifiedDate' };
        if (hasCaseNumber) {
            selectFields.add('CaseNumber');
        }
        if (hasSubject) {
            selectFields.add('Subject');
        }
        if (hasStatus) {
            selectFields.add('Status');
        }
        if (hasIsClosed) {
            selectFields.add('IsClosed');
        }

        String soql =
            'SELECT ' +
            String.join(selectFields, ', ') +
            ' FROM ' +
            apiName +
            ' WHERE Id IN :ids WITH SECURITY_ENFORCED';

        for (SObject record : Database.query(soql)) {
            RecordDetailDto dto = new RecordDetailDto();
            dto.id = String.valueOf(record.get('Id'));
            dto.objectApiName = apiName;
            dto.createdDate = (Datetime) record.get('CreatedDate');
            dto.lastModifiedDate = (Datetime) record.get('LastModifiedDate');
            if (hasCaseNumber) {
                dto.caseNumber = (String) record.get('CaseNumber');
            }
            if (hasSubject) {
                dto.subject = (String) record.get('Subject');
            }
            if (hasStatus) {
                dto.recordStatus = (String) record.get('Status');
            }
            if (hasIsClosed) {
                dto.recordClosed = (Boolean) record.get('IsClosed');
            }
            result.add(dto);
        }
        return result;
    }

    @TestVisible
    private static Schema.DescribeSObjectResult describeFor(String apiName) {
        Schema.SObjectType soType = Schema.getGlobalDescribe().get(apiName);
        return soType == null ? null : soType.getDescribe();
    }
}
