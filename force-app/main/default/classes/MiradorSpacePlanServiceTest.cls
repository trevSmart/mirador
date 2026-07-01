@IsTest
private class MiradorSpacePlanServiceTest {

    /** Builds a nested plan: root folder "Barcelona" (with an image) holding two
        spaces (one with full geometry, inactive) and one nested child folder
        "Madrid" (inactive, empty). */
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
        space1.active = false; // explicitly inactive; must round-trip

        MiradorSpacePlanService.SpaceDto space2 = new MiradorSpacePlanService.SpaceDto();
        space2.id = 'space_bbb';
        space2.name = 'Planta Suport';
        space2.dir = 0;
        space2.cells = new List<List<Integer>>();
        space2.seats = new List<MiradorSpacePlanService.SeatDto>();
        space2.openings = new List<MiradorSpacePlanService.OpeningDto>();
        space2.dividers = new List<MiradorSpacePlanService.DividerDto>();

        // Nested child folder, explicitly inactive and empty.
        MiradorSpacePlanService.FolderDto child = new MiradorSpacePlanService.FolderDto();
        child.id = 'folder_child';
        child.name = 'Madrid';
        child.active = false; // explicitly inactive; must round-trip
        child.folders = new List<MiradorSpacePlanService.FolderDto>();
        child.spaces = new List<MiradorSpacePlanService.SpaceDto>();

        MiradorSpacePlanService.FolderDto root = new MiradorSpacePlanService.FolderDto();
        root.id = 'folder_root';
        root.name = 'Barcelona';
        root.image = 'data:image/png;base64,AAAA';
        // root.active left unset → defaults to true on save/load.
        root.folders = new List<MiradorSpacePlanService.FolderDto>{ child };
        root.spaces = new List<MiradorSpacePlanService.SpaceDto>{ space1, space2 };

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 4;
        plan.activeFolderId = 'folder_root';
        plan.activeSpaceId = 'space_aaa';
        plan.folders = new List<MiradorSpacePlanService.FolderDto>{ root };
        return plan;
    }

    private static MiradorSpacePlanService.FolderDto folderById(
        List<MiradorSpacePlanService.FolderDto> folders, String appId
    ) {
        for (MiradorSpacePlanService.FolderDto f : folders) {
            if (f.id == appId) {
                return f;
            }
        }
        return null;
    }

    @IsTest
    static void getPlanReturnsNullWhenEmpty() {
        Test.startTest();
        MiradorSpacePlanService.PlanDto plan = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(null, plan, 'no folders saved → null plan');
    }

    @IsTest
    static void saveThenGetRoundTrips() {
        Test.startTest();
        MiradorSpacePlanService.savePlan(samplePlan());
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertNotEquals(null, loaded, 'plan loads back');
        System.assertEquals(4, loaded.v, 'schema version preserved');
        System.assertEquals('folder_root', loaded.activeFolderId, 'active folder id preserved');
        System.assertEquals('space_aaa', loaded.activeSpaceId, 'active space id preserved');
        System.assertEquals(1, loaded.folders.size(), 'one root folder');

        MiradorSpacePlanService.FolderDto root = loaded.folders[0];
        System.assertEquals('folder_root', root.id, 'root round-trips by app id');
        System.assertEquals('Barcelona', root.name, 'folder name preserved');
        System.assertEquals('data:image/png;base64,AAAA', root.image, 'folder image preserved');
        System.assertEquals(true, root.active, 'unset folder active defaults to true');
        System.assertEquals(2, root.spaces.size(), 'both spaces loaded');
        System.assertEquals(1, root.folders.size(), 'nested child folder loaded');

        // Inactive child folder must come back inactive, with no image.
        MiradorSpacePlanService.FolderDto child = root.folders[0];
        System.assertEquals('folder_child', child.id, 'child round-trips');
        System.assertEquals(false, child.active, 'inactive folder stays inactive');
        System.assertEquals(0, child.spaces.size(), 'empty folder preserved');

        // SortOrder must keep the original space ordering.
        System.assertEquals('space_aaa', root.spaces[0].id, 'first space order');
        System.assertEquals('space_bbb', root.spaces[1].id, 'second space order');

        MiradorSpacePlanService.SpaceDto s1 = root.spaces[0];
        System.assertEquals('Planta Vendes', s1.name, 'space name preserved');
        System.assertEquals(2, s1.dir, 'dir preserved');
        System.assertEquals(false, s1.active, 'inactive space stays inactive');
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

        // Second save with a single, different folder must wipe the first plan.
        MiradorSpacePlanService.SpaceDto space = new MiradorSpacePlanService.SpaceDto();
        space.id = 'space_new';
        space.name = 'Nova';
        space.dir = 0;

        MiradorSpacePlanService.FolderDto folder = new MiradorSpacePlanService.FolderDto();
        folder.id = 'folder_new';
        folder.name = 'Girona';
        folder.folders = new List<MiradorSpacePlanService.FolderDto>();
        folder.spaces = new List<MiradorSpacePlanService.SpaceDto>{ space };

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 4;
        plan.activeFolderId = 'folder_new';
        plan.activeSpaceId = 'space_new';
        plan.folders = new List<MiradorSpacePlanService.FolderDto>{ folder };

        Test.startTest();
        MiradorSpacePlanService.savePlan(plan);
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(1, loaded.folders.size(), 'old folders replaced');
        System.assertEquals('folder_new', loaded.folders[0].id, 'only new folder remains');
        System.assertEquals(1, [SELECT COUNT() FROM Folder__c], 'one Folder row in org');
        System.assertEquals(1, [SELECT COUNT() FROM Space__c], 'one Space row in org');
    }

    @IsTest
    static void savePlanWithNoFoldersClears() {
        MiradorSpacePlanService.savePlan(samplePlan());

        MiradorSpacePlanService.PlanDto empty = new MiradorSpacePlanService.PlanDto();
        empty.v = 4;
        empty.folders = new List<MiradorSpacePlanService.FolderDto>();

        Test.startTest();
        MiradorSpacePlanService.savePlan(empty);
        MiradorSpacePlanService.PlanDto loaded = MiradorSpacePlanService.getPlan();
        Test.stopTest();

        System.assertEquals(null, loaded, 'empty save clears the plan');
        System.assertEquals(0, [SELECT COUNT() FROM Folder__c], 'no Folder rows left');
        System.assertEquals(0, [SELECT COUNT() FROM Space__c], 'no Space rows left');
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
        MiradorSpacePlanService.FolderDto folder = new MiradorSpacePlanService.FolderDto();
        folder.id = 'folder_long';
        folder.name = longName;
        folder.folders = new List<MiradorSpacePlanService.FolderDto>();
        folder.spaces = new List<MiradorSpacePlanService.SpaceDto>();

        MiradorSpacePlanService.PlanDto plan = new MiradorSpacePlanService.PlanDto();
        plan.v = 4;
        plan.folders = new List<MiradorSpacePlanService.FolderDto>{ folder };

        Test.startTest();
        MiradorSpacePlanService.savePlan(plan);
        Test.stopTest();

        Folder__c row = [SELECT Name FROM Folder__c LIMIT 1];
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
        System.assertEquals(1, loaded.folders.size(), 'root folder returned over REST');
        System.assertEquals(1, loaded.folders[0].folders.size(), 'nested folder returned over REST');
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
