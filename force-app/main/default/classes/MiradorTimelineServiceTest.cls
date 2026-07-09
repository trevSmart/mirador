@IsTest
private class MiradorTimelineServiceTest {
    // UserServicePresence and AgentWork are read-only system objects that cannot
    // be inserted in a test, so these exercise the shape, routing and helpers;
    // the day's rows come back empty in test context.

    @IsTest
    static void getTimelineReturnsShape() {
        Id userId = UserInfo.getUserId();
        Test.startTest();
        Map<String, Object> res = MiradorTimelineService.getTimeline(userId, '2026-07-09');
        Test.stopTest();

        Map<String, Object> timeline = (Map<String, Object>) res.get('timeline');
        System.assertNotEquals(null, timeline, 'timeline present');
        System.assertEquals(String.valueOf(userId), timeline.get('agentId'), 'agentId echoed');
        System.assertEquals('2026-07-09', timeline.get('day'), 'day echoed');
        System.assert(timeline.get('presence') instanceof List<Object>, 'presence is a list');
        System.assert(timeline.get('work') instanceof List<Object>, 'work is a list');
    }

    @IsTest
    static void getTimelineBlankDayFallsBackToToday() {
        Id userId = UserInfo.getUserId();
        Test.startTest();
        Map<String, Object> res = MiradorTimelineService.getTimeline(userId, null);
        Test.stopTest();

        Map<String, Object> timeline = (Map<String, Object>) res.get('timeline');
        System.assertEquals(null, timeline.get('day'), 'blank day echoed as-is');
        System.assert(timeline.containsKey('presence'), 'presence key present');
    }

    @IsTest
    static void getTimelineInvalidDayDoesNotThrow() {
        Test.startTest();
        Map<String, Object> res = MiradorTimelineService.getTimeline(UserInfo.getUserId(), 'not-a-date');
        Test.stopTest();
        System.assertNotEquals(null, res.get('timeline'), 'invalid day handled gracefully');
    }

    @IsTest
    static void isoUtcFormatsAndHandlesNull() {
        Datetime dt = Datetime.newInstanceGmt(2026, 7, 9, 13, 5, 30);
        System.assertEquals('2026-07-09T13:05:30.000Z', MiradorTimelineService.isoUtc(dt), 'UTC ISO');
        System.assertEquals(null, MiradorTimelineService.isoUtc(null), 'null passes through');
    }

    @IsTest
    static void timelineRouteViaRestHandler() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/agents/' + UserInfo.getUserId() + '/timeline';
        req.httpMethod = 'GET';
        req.addParameter('day', '2026-07-09');
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorApi.handleGet();
        Test.stopTest();

        System.assertEquals(200, RestContext.response.statusCode, 'route resolves');
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            RestContext.response.responseBody.toString());
        System.assert(body.containsKey('timeline'), 'timeline key present');
    }
}
