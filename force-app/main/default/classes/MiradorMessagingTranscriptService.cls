/**
 * Proxies Messaging conversation transcripts from the Connect REST API.
 * Off-platform message data is not available via SOQL on ConversationEntry.
 */
public with sharing class MiradorMessagingTranscriptService {
    public class EntryDto {
        public String identifier;
        public String messageText;
        public Long clientTimestamp;
        public Long serverReceivedTimestamp;
        public String senderRole;
        public String senderSubject;
    }

    public class TranscriptDto {
        public String messagingSessionId;
        public String conversationIdentifier;
        public String endUserName;
        public String sessionStatus;
        public List<EntryDto> entries;
    }

    public class TranscriptException extends Exception {}

    public static TranscriptDto getTranscript(
        String messagingSessionId,
        String conversationIdentifier,
        Integer recordLimit,
        String queryDirection
    ) {
        Id sessionId = parseMessagingSessionId(messagingSessionId);

        String uuid = String.isBlank(conversationIdentifier) ? null : conversationIdentifier.trim();
        String endUserName = null;
        String sessionStatus = null;

        if (String.isBlank(uuid)) {
            MessagingSession ms = loadMessagingSession(sessionId);
            if (ms == null) {
                throw new TranscriptException('Messaging session not found');
            }
            uuid = ms.Conversation == null ? null : ms.Conversation.ConversationIdentifier;
            endUserName = ms.MessagingEndUser == null ? null : ms.MessagingEndUser.Name;
            sessionStatus = ms.Status;
        } else if (Schema.sObjectType.MessagingSession.isAccessible()) {
            List<MessagingSession> rows = [
                SELECT Status, MessagingEndUser.Name
                FROM MessagingSession
                WHERE Id = :sessionId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            if (!rows.isEmpty()) {
                sessionStatus = rows[0].Status;
                endUserName = rows[0].MessagingEndUser == null
                    ? null
                    : rows[0].MessagingEndUser.Name;
            }
        }

        TranscriptDto response = new TranscriptDto();
        response.messagingSessionId = String.valueOf(sessionId);
        response.conversationIdentifier = uuid;
        response.endUserName = endUserName;
        response.sessionStatus = sessionStatus;
        response.entries = new List<EntryDto>();

        if (String.isBlank(uuid)) {
            return response;
        }

        Integer limitVal = recordLimit == null ? 1000 : recordLimit;
        if (limitVal < 1) {
            limitVal = 1;
        } else if (limitVal > 1000) {
            limitVal = 1000;
        }

        String direction = String.isBlank(queryDirection) ? 'FromStart' : queryDirection;
        if (direction != 'FromStart' && direction != 'FromEnd') {
            direction = 'FromStart';
        }

        String body = fetchConversationEntries(uuid, limitVal, direction);
        response.entries = parseConnectEntries(body);
        return response;
    }

    @TestVisible
    private static Id parseMessagingSessionId(String messagingSessionId) {
        if (String.isBlank(messagingSessionId)) {
            throw new TranscriptException('Invalid messaging session id');
        }
        try {
            Id sessionId = (Id) messagingSessionId;
            if (sessionId.getSObjectType() != MessagingSession.SObjectType) {
                throw new TranscriptException('Invalid messaging session id');
            }
            return sessionId;
        } catch (Exception ex) {
            throw new TranscriptException('Invalid messaging session id');
        }
    }

    private static MessagingSession loadMessagingSession(Id sessionId) {
        if (!Schema.sObjectType.MessagingSession.isAccessible()) {
            return null;
        }
        List<MessagingSession> rows = [
            SELECT Id, Status, Conversation.ConversationIdentifier, MessagingEndUser.Name
            FROM MessagingSession
            WHERE Id = :sessionId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    private static String fetchConversationEntries(
        String conversationIdentifier,
        Integer recordLimit,
        String queryDirection
    ) {
        String base = URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/v67.0/connect/conversation/'
            + EncodingUtil.urlEncode(conversationIdentifier, 'UTF-8')
            + '/entries?recordLimit='
            + String.valueOf(recordLimit)
            + '&queryDirection='
            + EncodingUtil.urlEncode(queryDirection, 'UTF-8');

        HttpRequest req = new HttpRequest();
        req.setEndpoint(base);
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new TranscriptException('Failed to load conversation transcript');
        }
        return res.getBody();
    }

    @TestVisible
    private static List<EntryDto> parseConnectEntries(String body) {
        List<EntryDto> entries = new List<EntryDto>();
        if (String.isBlank(body)) {
            return entries;
        }

        Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(body);
        Object rawEntries = root.get('conversationEntries');
        if (!(rawEntries instanceof List<Object>)) {
            return entries;
        }

        for (Object item : (List<Object>) rawEntries) {
            if (!(item instanceof Map<String, Object>)) {
                continue;
            }
            Map<String, Object> row = (Map<String, Object>) item;
            EntryDto dto = new EntryDto();
            dto.identifier = (String) row.get('identifier');
            dto.messageText = (String) row.get('messageText');
            dto.clientTimestamp = toLong(row.get('clientTimestamp'));
            dto.serverReceivedTimestamp = toLong(row.get('serverReceivedTimestamp'));

            Object senderObj = row.get('sender');
            if (senderObj instanceof Map<String, Object>) {
                Map<String, Object> sender = (Map<String, Object>) senderObj;
                dto.senderRole = (String) sender.get('role');
                dto.senderSubject = (String) sender.get('subject');
            }

            entries.add(dto);
        }
        return entries;
    }

    @TestVisible
    private static Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Long) {
            return (Long) value;
        }
        if (value instanceof Integer) {
            Integer intVal = (Integer) value;
            return intVal;
        }
        if (value instanceof Decimal) {
            return ((Decimal) value).longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }
}
