@IsTest
private class MiradorApiTest {
    @IsTest
    static void getCapabilitiesRoute() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/capabilities';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        MiradorApi.handleGet();
        Test.stopTest();
        System.assertEquals(200, RestContext.response.statusCode);
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            RestContext.response.responseBody.toString());
        System.assert(body.containsKey('canChangeSkills'), 'capabilities payload');
    }

    @IsTest
    static void getSnapshotRoute() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/snapshot';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        MiradorApi.handleGet();
        Test.stopTest();
        System.assertEquals(200, RestContext.response.statusCode);
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            RestContext.response.responseBody.toString());
        System.assert(body.containsKey('agents'), 'agents key');
        System.assert(body.containsKey('queues'), 'queues key');
        System.assert(body.containsKey('skills'), 'skills key');
        System.assert(body.containsKey('work'), 'work key');
    }

    @IsTest
    static void getSnapshotScopeParam() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/snapshot';
        req.httpMethod = 'GET';
        req.addParameter('scope', 'connected');
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        MiradorApi.handleGet();
        Test.stopTest();
        System.assertEquals(200, RestContext.response.statusCode);
    }
}