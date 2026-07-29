@IsTest
private class MiradorMessagingTranscriptServiceTest {
    @IsTest
    static void parseConnectEntriesMapsAgentAndEndUser() {
        String body =
            '{"conversationEntries":[' +
            '{"identifier":"a","messageText":"bona tarda","clientTimestamp":1785286661945,' +
            '"serverReceivedTimestamp":1785286662084,' +
            '"sender":{"appType":"agent","role":"Agent","subject":"005fj00000Gp1gn"}},' +
            '{"identifier":"b","messageText":"que tal","clientTimestamp":1785286665201,' +
            '"serverReceivedTimestamp":1785286665268,' +
            '"sender":{"appType":"iamessage","role":"EndUser","subject":"v2/iamessage/uid:abc"}}' +
            ']}';

        Test.startTest();
        List<MiradorMessagingTranscriptService.EntryDto> entries =
            MiradorMessagingTranscriptService.parseConnectEntries(body);
        Test.stopTest();

        System.assertEquals(2, entries.size(), 'two entries expected');
        System.assertEquals('bona tarda', entries[0].messageText);
        System.assertEquals('Agent', entries[0].senderRole);
        System.assertEquals('EndUser', entries[1].senderRole);
        System.assertEquals('que tal', entries[1].messageText);
    }

    @IsTest
    static void parseConnectEntriesEmptyPayload() {
        System.assertEquals(
            0,
            MiradorMessagingTranscriptService.parseConnectEntries('{"conversationEntries":[]}').size()
        );
        System.assertEquals(
            0,
            MiradorMessagingTranscriptService.parseConnectEntries('').size()
        );
    }

    @IsTest
    static void parseMessagingSessionIdRejectsInvalid() {
        Boolean threw = false;
        try {
            MiradorMessagingTranscriptService.parseMessagingSessionId('not-an-id');
        } catch (MiradorMessagingTranscriptService.TranscriptException ex) {
            threw = true;
        }
        System.assertEquals(true, threw, 'invalid id should throw');
    }

    @IsTest
    static void parseMessagingSessionIdRejectsNonMessagingPrefix() {
        Case c = new Case(Subject = 'No session');
        insert c;

        Boolean threw = false;
        try {
            MiradorMessagingTranscriptService.parseMessagingSessionId(String.valueOf(c.Id));
        } catch (MiradorMessagingTranscriptService.TranscriptException ex) {
            threw = true;
        }
        System.assertEquals(true, threw, 'non MessagingSession id should throw');
    }
}
