@IsTest
private class MiradorSpacePlanServiceTest {

    /** Builds a two-place plan: place A with two spaces (one with full geometry),
        place B with no spaces. */
    private static MiradorSpacePlanService.PlanDto samplePlan() {
        MiradorSpacePlanService.SeatDto seat = new MiradorSpacePlanService.SeatDto();
        seat.c = 3;
        seat.r = 4;
        seat.agentId = '005000000000001';

        MiradorSpacePlanService.SeatDto emptySeat = new MiradorSpacePlanService.SeatDto();
        emptySeat.c = 5;
        emptySeat.r = 4;
        emptySeat.agentId = null;

        MiradorSpacePlanService.OpeningDto opening = new MiradorSpacePlanService.OpeningDto();
        opening.c = 2;
        opening.r = 2;
        opening.edge = 'N';
        opening.kind = 'door';

        MiradorSpacePlanService.DividerDto divider = new MiradorSpacePlanService.DividerDto();
        divider.c = 3;
        divider.r = 3;
        divider.edge = 'E';

        MiradorSpacePlanService.SpaceDto space1 = new MiradorSpacePlanService.SpaceDto();
        space1.id = 'space_aaa';
        space1.name = 'Planta Vendes';
        space1.dir = 2;
        space1.cells = new List<List<Integer>>{ new List<Integer>{ 2, 2 }, new List<Integer>{ 3, 2 } };
        space1.seats = new List<MiradorSpacePlanService.SeatDto>{ seat, emptySeat };
        space1.openings = new List<MiradorSpacePlanService.OpeningDto>{ opening };
        space1.dividers = new List<MiradorSpacePlanService.DividerDto>{ divider };

        MiradorSpacePlanService.SpaceDto space2 = new MiradorSpacePlanService.SpaceDto();
        space2.id = 'space_bbb';
        space2.name = 'Planta Suport';
        space2.dir = 0;
        space2.cells = new List<List<Integer>>();
        space2.seats = new List<MiradorSpacePlanService.SeatDto>();
        space2.openings = new List<MiradorSpacePlanService.OpeningDto>();
        space2.dividers = new List<MiradorSpacePlanService.DividerDto>();

        MiradorSpacePlanService.PlaceDto placeA = new MiradorSpacePlanService.PlaceDto();
        placeA.id = 'place_aaa';
        placeA.name = 'Barcelona';
        placeA.spaces = new List<MiradorSpacePlanService.SpaceDto>{ space1, space2 };

        MiradorSpacePlanService.PlaceDto placeB = new MiradorSpacePlanService.PlaceDto();
        placeB.id = 'place_bbb';
        placeB.name = 'Madrid';
        placeB.spaces = new List<MiradorSpacePlanService.SpaceDto>();

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 2;
        plan.activePlaceId = 'space_aaa';
        plan.places = new List<MiradorSpacePlanService.PlaceDto>{ placeA, placeB };
        return plan;
    }

    @IsTest
    static void getPlanReturnsNullWhenEmpty() {
        Test.startTest();
        MiradorSpacePlanService.PlanDto plan = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(null, plan, 'no places saved → null plan');
    }

    @IsTest
    static void saveThenGetRoundTrips() {
        Test.startTest();
        MiradorSpacePlanService.savePlan(samplePlan());
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertNotEquals(null, loaded, 'plan loads back');
        System.assertEquals(2, loaded.v, 'schema version preserved');
        System.assertEquals('space_aaa', loaded.activePlaceId, 'active id preserved');
        System.assertEquals(2, loaded.places.size(), 'both places loaded');

        MiradorSpacePlanService.PlaceDto placeA;
        for (MiradorSpacePlanService.PlaceDto p : loaded.places) {
            if (p.id == 'place_aaa') {
                placeA = p;
            }
        }
        System.assertNotEquals(null, placeA, 'place A round-trips by app id');
        System.assertEquals('Barcelona', placeA.name, 'place name preserved');
        System.assertEquals(2, placeA.spaces.size(), 'both spaces loaded');

        // SortOrder must keep the original space ordering.
        System.assertEquals('space_aaa', placeA.spaces[0].id, 'first space order');
        System.assertEquals('space_bbb', placeA.spaces[1].id, 'second space order');

        MiradorSpacePlanService.SpaceDto s1 = placeA.spaces[0];
        System.assertEquals('Planta Vendes', s1.name, 'space name preserved');
        System.assertEquals(2, s1.dir, 'dir preserved');
        System.assertEquals(2, s1.cells.size(), 'cells preserved');
        System.assertEquals(2, s1.seats.size(), 'seats preserved (incl. empty)');
        System.assertEquals(1, s1.openings.size(), 'openings preserved');
        System.assertEquals(1, s1.dividers.size(), 'dividers preserved');
        System.assertEquals('005000000000001', s1.seats[0].agentId, 'agent id preserved');
        System.assertEquals(null, s1.seats[1].agentId, 'empty seat stays empty');
        System.assertEquals('door', s1.openings[0].kind, 'opening kind preserved');
        System.assertEquals('E', s1.dividers[0].edge, 'divider edge preserved');
    }

    @IsTest
    static void savePlanIsFullReplace() {
        MiradorSpacePlanService.savePlan(samplePlan());

        // Second save with a single, different place must wipe the first plan.
        MiradorSpacePlanService.SpaceDto space = new MiradorSpacePlanService.SpaceDto();
        space.id = 'space_new';
        space.name = 'Nova';
        space.dir = 0;

        MiradorSpacePlanService.PlaceDto place = new MiradorSpacePlanService.PlaceDto();
        place.id = 'place_new';
        place.name = 'Girona';
        place.spaces = new List<MiradorSpacePlanService.SpaceDto>{ space };

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 2;
        plan.activePlaceId = 'space_new';
        plan.places = new List<MiradorSpacePlanService.PlaceDto>{ place };

        Test.startTest();
        MiradorSpacePlanService.savePlan(plan);
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(1, loaded.places.size(), 'old places replaced');
        System.assertEquals('place_new', loaded.places[0].id, 'only new place remains');
        System.assertEquals(1, [SELECT COUNT() FROM Place__c], 'one Place row in org');
        System.assertEquals(1, [SELECT COUNT() FROM Space__c], 'one Space row in org');
    }

    @IsTest
    static void savePlanWithNoPlacesClears() {
        MiradorSpacePlanService.savePlan(samplePlan());

        MiradorSpacePlanService.PlanDto empty = new MiradorSpacePlanService.PlanDto();
        empty.v = 2;
        empty.places = new List<MiradorSpacePlanService.PlaceDto>();

        Test.startTest();
        MiradorSpacePlanService.savePlan(empty);
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(null, loaded, 'empty save clears the plan');
        System.assertEquals(0, [SELECT COUNT() FROM Place__c], 'no Place rows left');
    }

    @IsTest
    static void savePlanNullThrows() {
        Boolean threw = false;
        Test.startTest();
        try {
            MiradorSpacePlanService.savePlan(null);
        } catch (MiradorSpacePlanService.SpacePlanException ex) {
            threw = true;
        }
        Test.stopTest();
        System.assert(threw, 'null plan throws SpacePlanException');
    }

    @IsTest
    static void longNamesAreClipped() {
        String longName = 'x'.repeat(120);
        MiradorSpacePlanService.PlaceDto place = new MiradorSpacePlanService.PlaceDto();
        place.id = 'place_long';
        place.name = longName;
        place.spaces = new List<MiradorSpacePlanService.SpaceDto>();

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 2;
        plan.places = new List<MiradorSpacePlanService.PlaceDto>{ place };

        Test.startTest();
        MiradorSpacePlanService.savePlan(plan);
        Test.stopTest();

        Place__c row = [SELECT Name FROM Place__c LIMIT 1];
        System.assertEquals(80, row.Name.length(), 'name clipped to 80 chars');
    }

    // ---- REST routing through MiradorRestHandler -------------------------------

    @IsTest
    static void restGetAndPutSpacePlan() {
        // PUT: save via the REST handler.
        RestRequest putReq = new RestRequest();
        putReq.requestURI = '/services/apexrest/mirador/v1/space-plan';
        putReq.httpMethod = 'PUT';
        putReq.requestBody = Blob.valueOf(JSON.serialize(samplePlan()));
        RestContext.request = putReq;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorRestHandler.handlePut('/mirador/v1');
        Integer putStatus = RestContext.response.statusCode;

        // GET: read it back via the REST handler.
        RestRequest getReq = new RestRequest();
        getReq.requestURI = '/services/apexrest/mirador/v1/space-plan';
        getReq.httpMethod = 'GET';
        RestContext.request = getReq;
        RestContext.response = new RestResponse();
        MiradorRestHandler.handleGet('/mirador/v1');
        Integer getStatus = RestContext.response.statusCode;
        String body = RestContext.response.responseBody.toString();
        Test.stopTest();

        System.assertEquals(200, putStatus, 'PUT ok');
        System.assertEquals(200, getStatus, 'GET ok');
        MiradorSpacePlanService.PlanDto loaded =
            (MiradorSpacePlanService.PlanDto) JSON.deserialize(body, MiradorSpacePlanService.PlanDto.class);
        System.assertNotEquals(null, loaded, 'GET returns the saved plan');
        System.assertEquals(2, loaded.places.size(), 'both places returned over REST');
    }

    @IsTest
    static void restPutRejectsEmptyBody() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/space-plan';
        req.httpMethod = 'PUT';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorRestHandler.handlePut('/mirador/v1');
        Test.stopTest();

        System.assertEquals(400, RestContext.response.statusCode, 'empty body → 400');
    }

    @IsTest
    static void restPutRejectsNullPlan() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/space-plan';
        req.httpMethod = 'PUT';
        // Valid JSON, but the literal null deserializes to a null PlanDto.
        req.requestBody = Blob.valueOf('null');
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorRestHandler.handlePut('/mirador/v1');
        Test.stopTest();

        System.assertEquals(400, RestContext.response.statusCode, 'null plan → 400, not 500');
    }

    @IsTest
    static void restPutRejectsInvalidJson() {
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/mirador/v1/space-plan';
        req.httpMethod = 'PUT';
        req.requestBody = Blob.valueOf('{ not valid json ');
        RestContext.request = req;
        RestContext.response = new RestResponse();

        Test.startTest();
        MiradorRestHandler.handlePut('/mirador/v1');
        Test.stopTest();

        System.assertEquals(400, RestContext.response.statusCode, 'invalid JSON → 400');
    }
}
