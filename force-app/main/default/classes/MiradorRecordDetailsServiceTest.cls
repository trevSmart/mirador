@IsTest
private class MiradorRecordDetailsServiceTest {
    @IsTest
    static void getRecordDetailsForCase() {
        Case c = new Case(Subject = 'Test subject');
        insert c;

        Test.startTest();
        MiradorRecordDetailsService.RecordDetailsResponse response =
            MiradorRecordDetailsService.getRecordDetails(new List<Id>{ c.Id });
        Test.stopTest();

        System.assertEquals(1, response.records.size(), 'one record expected');
        MiradorRecordDetailsService.RecordDetailDto dto = response.records[0];
        System.assertEquals(String.valueOf(c.Id), dto.id, 'id matches');
        System.assertEquals('Case', dto.objectApiName, 'object api name');
        System.assertNotEquals(null, dto.createdDate, 'createdDate populated');
        System.assertNotEquals(null, dto.lastModifiedDate, 'lastModifiedDate populated');
        System.assertNotEquals(null, dto.caseNumber, 'caseNumber populated for Case');
        System.assertEquals('Test subject', dto.subject, 'subject populated for Case');
    }

    @IsTest
    static void getRecordDetailsCaseStatus() {
        Case open = new Case(Subject = 'Obert', Status = 'New');
        insert open;
        Case closed = new Case(Subject = 'Tancat', Status = 'Closed');
        insert closed;

        Test.startTest();
        MiradorRecordDetailsService.RecordDetailsResponse response =
            MiradorRecordDetailsService.getRecordDetails(new List<Id>{ open.Id, closed.Id });
        Test.stopTest();

        Map<Id, MiradorRecordDetailsService.RecordDetailDto> byId =
            new Map<Id, MiradorRecordDetailsService.RecordDetailDto>();
        for (MiradorRecordDetailsService.RecordDetailDto dto : response.records) {
            byId.put((Id) dto.id, dto);
        }

        System.assertEquals('New', byId.get(open.Id).recordStatus, 'open status');
        System.assertEquals(false, byId.get(open.Id).recordClosed, 'open not closed');
        System.assertEquals('Closed', byId.get(closed.Id).recordStatus, 'closed status');
        System.assertEquals(true, byId.get(closed.Id).recordClosed, 'closed is closed');
    }

    @IsTest
    static void getRecordDetailsEmptyList() {
        Test.startTest();
        MiradorRecordDetailsService.RecordDetailsResponse empty =
            MiradorRecordDetailsService.getRecordDetails(new List<Id>());
        MiradorRecordDetailsService.RecordDetailsResponse nullCase =
            MiradorRecordDetailsService.getRecordDetails(null);
        Test.stopTest();

        System.assertEquals(0, empty.records.size(), 'empty input → no records');
        System.assertEquals(0, nullCase.records.size(), 'null input → no records');
    }

    @IsTest
    static void getRecordDetailsGenericType() {
        // A type without CaseNumber/Subject still returns the common audit fields.
        Account a = new Account(Name = 'Acme');
        insert a;

        Test.startTest();
        MiradorRecordDetailsService.RecordDetailsResponse response =
            MiradorRecordDetailsService.getRecordDetails(new List<Id>{ a.Id });
        Test.stopTest();

        System.assertEquals(1, response.records.size(), 'one record expected');
        MiradorRecordDetailsService.RecordDetailDto dto = response.records[0];
        System.assertEquals('Account', dto.objectApiName, 'object api name');
        System.assertNotEquals(null, dto.createdDate, 'createdDate populated');
        System.assertNotEquals(null, dto.lastModifiedDate, 'lastModifiedDate populated');
        System.assertEquals(null, dto.caseNumber, 'no caseNumber for Account');
        System.assertEquals(null, dto.recordStatus, 'no recordStatus for Account');
        System.assertEquals(null, dto.recordClosed, 'no recordClosed for Account');
    }

    @IsTest
    static void postRouteReturnsRecords() {
        Case c = new Case(Subject = 'Routed case');
        insert c;

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/records/details';
        req.httpMethod = 'POST';
        req.requestBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{
            'ids' => new List<String>{ String.valueOf(c.Id) }
        }));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorApi.handlePost();
        Test.stopTest();

        System.assertEquals(200, RestContext.response.statusCode, 'status 200');
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            RestContext.response.responseBody.toString());
        System.assert(body.containsKey('records'), 'records key present');
        List<Object> records = (List<Object>) body.get('records');
        System.assertEquals(1, records.size(), 'one record in payload');
    }

    @IsTest
    static void postRouteEmptyBodyReturns400() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/records/details';
        req.httpMethod = 'POST';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorApi.handlePost();
        Test.stopTest();

        System.assertEquals(400, RestContext.response.statusCode, 'empty body → 400');
    }

    @IsTest
    static void postRouteUnknownPathReturns404() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/records/nope';
        req.httpMethod = 'POST';
        req.requestBody = Blob.valueOf('{}');
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorApi.handlePost();
        Test.stopTest();

        System.assertEquals(404, RestContext.response.statusCode, 'unknown path → 404');
    }
}
