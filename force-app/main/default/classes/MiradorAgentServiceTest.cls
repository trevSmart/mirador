@IsTest
private class MiradorAgentServiceTest {
    @IsTest
    static void mapsPresenceLabels() {
        // DeveloperName-driven mapping for the org's real Mirador_* statuses.
        System.assertEquals('online', MiradorAgentService.mapPresenceStatus('Mirador_Available', 'Available'));
        System.assertEquals('online', MiradorAgentService.mapPresenceStatus('AvailableforVoice', 'Available for Voice'));
        System.assertEquals('away', MiradorAgentService.mapPresenceStatus('Mirador_Away', 'Away'));
        System.assertEquals('busy', MiradorAgentService.mapPresenceStatus('Mirador_Busy', 'Busy'));
        System.assertEquals('offline', MiradorAgentService.mapPresenceStatus('Mirador_Offline', 'Offline'));

        // Falls back to MasterLabel when DeveloperName is unhelpful.
        System.assertEquals('away', MiradorAgentService.mapPresenceStatus('Custom_01', 'On Break'));
        System.assertEquals('busy', MiradorAgentService.mapPresenceStatus(null, 'Ocupat'));
        System.assertEquals('offline', MiradorAgentService.mapPresenceStatus(null, 'Unavailable'));

        // Fail-safe: an unrecognized status is treated as offline, never online.
        System.assertEquals('offline', MiradorAgentService.mapPresenceStatus('Status_X', 'Reunió de equip'));
        System.assertEquals('offline', MiradorAgentService.mapPresenceStatus(null, null));
    }

    @IsTest
    static void mapsChannelKeys() {
        System.assertEquals('cas', MiradorAgentService.mapChannelKey('Mirador_Case', 'Mirador Case'));
        System.assertEquals('veu', MiradorAgentService.mapChannelKey('sfdc_phone', 'Phone'));
        System.assertEquals('chat', MiradorAgentService.mapChannelKey('sfdc_livemessage', 'Messaging'));
        System.assertEquals('email', MiradorAgentService.mapChannelKey(null, 'Email'));
        System.assertEquals('cas', MiradorAgentService.mapChannelKey(null, null));
    }

    @IsTest
    static void buildPhotoUrlHandlesAbsoluteAndRelativePaths() {
        String orgUrl = 'https://example.my.salesforce.com';
        System.assertEquals(null, MiradorAgentService.buildPhotoUrl(orgUrl, null));
        System.assertEquals(
            'https://example.file.force.com/profilephoto/005/T',
            MiradorAgentService.buildPhotoUrl(orgUrl, 'https://example.file.force.com/profilephoto/005/T')
        );
        System.assertEquals(
            'https://example.file.force.com/profilephoto/005/T',
            MiradorAgentService.buildPhotoUrl(orgUrl, 'https//example.file.force.com/profilephoto/005/T')
        );
        System.assertEquals(
            'https://example.my.salesforce.com/profilephoto/005/T',
            MiradorAgentService.buildPhotoUrl(orgUrl, '/profilephoto/005/T')
        );
    }

    @IsTest
    static void buildRecordUrlHandlesOrgBaseAndRecordId() {
        String orgUrl = 'https://example.my.salesforce.com/';
        System.assertEquals(
            'https://example.my.salesforce.com/' + UserInfo.getUserId(),
            MiradorAgentService.buildRecordUrl(orgUrl, UserInfo.getUserId())
        );
        System.assertEquals(null, MiradorAgentService.buildRecordUrl(orgUrl, null));
    }

    /**
     * A freshly inserted user with no real group memberships, so membership
     * assertions stay deterministic even when the org already has queues and
     * GroupMember rows (the running user usually does).
     */
    private static User insertIsolatedUser() {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String unique = String.valueOf(System.now().getTime()) + String.valueOf(Math.abs(Crypto.getRandomLong()));
        User u = new User(
            ProfileId = p.Id,
            LastName = 'Mirador Membership',
            Email = 'mirador.membership.' + unique + '@example.com',
            Username = 'mirador.membership.' + unique + '@example.com.invalid',
            Alias = 'pmem',
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        // User is a setup object; isolate its DML so the GroupMember inserts in
        // the test body don't trigger a MIXED_DML_OPERATION error.
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert u;
        }
        return u;
    }

    @IsTest
    static void loadQueueIdsByUserReturnsMembership() {
        User u = insertIsolatedUser();
        Group q = new Group(Name = 'Mirador Test Queue', Type = 'Queue');
        insert q;
        insert new QueueSObject(QueueId = q.Id, SObjectType = 'Case');

        insert new GroupMember(GroupId = q.Id, UserOrGroupId = u.Id);

        Test.startTest();
        Map<Id, List<String>> byUser = MiradorGroupMembership.loadQueueIdsByUser(new Set<Id>{ u.Id });
        Test.stopTest();

        System.assertEquals(1, byUser.get(u.Id).size());
        System.assertEquals(String.valueOf(q.Id), byUser.get(u.Id)[0]);
    }

    @IsTest
    static void loadQueueIdsByUserResolvesNestedGroupMembership() {
        User u = insertIsolatedUser();
        Group nested = new Group(Name = 'Mirador Nested Group', Type = 'Regular');
        insert nested;
        Group q = new Group(Name = 'Mirador Nested Queue', Type = 'Queue');
        insert q;
        insert new QueueSObject(QueueId = q.Id, SObjectType = 'Case');

        insert new GroupMember(GroupId = nested.Id, UserOrGroupId = u.Id);
        insert new GroupMember(GroupId = q.Id, UserOrGroupId = nested.Id);

        Test.startTest();
        Map<Id, List<String>> byUser = MiradorGroupMembership.loadQueueIdsByUser(new Set<Id>{ u.Id });
        Test.stopTest();

        System.assertEquals(1, byUser.get(u.Id).size());
        System.assertEquals(String.valueOf(q.Id), byUser.get(u.Id)[0]);
    }

    @IsTest
    static void mergeQueueIdsIncludesActiveWorkQueues() {
        List<String> membership = new List<String>{ '00G000000000001' };
        List<MiradorAgentService.WorkItemDto> workItems = new List<MiradorAgentService.WorkItemDto>();
        MiradorAgentService.WorkItemDto item = new MiradorAgentService.WorkItemDto();
        item.queueId = '00G000000000002';
        workItems.add(item);

        Test.startTest();
        List<String> merged = MiradorAgentService.mergeQueueIds(membership, workItems);
        Test.stopTest();

        System.assertEquals(2, merged.size());
        System.assert(merged.contains('00G000000000001'));
        System.assert(merged.contains('00G000000000002'));
    }

    @IsTest
    static void getAgentsReturnsList() {
        Test.startTest();
        MiradorAgentService.AgentsResponse response = MiradorAgentService.getAgents();
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.agents);
        for (MiradorAgentService.AgentDto a : response.agents) {
            System.assertNotEquals(null, a.skills, 'each agent should carry an embedded skills list');
        }
    }

    @IsTest
    static void getAgentsAllScopeReturnsList() {
        Test.startTest();
        MiradorAgentService.AgentsResponse response = MiradorAgentService.getAgents('all');
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.agents);
        for (MiradorAgentService.AgentDto a : response.agents) {
            System.assertNotEquals(null, a.skills, 'each agent should carry an embedded skills list');
        }
    }

    @IsTest
    static void getAgentsBySkillReturnsList() {
        Test.startTest();
        MiradorAgentService.AgentsResponse response =
            MiradorAgentService.getAgentsBySkill('0C5000000000001AAA');
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.agents);
    }

    @IsTest
    static void getAgentsBySkillNullReturnsEmpty() {
        Test.startTest();
        MiradorAgentService.AgentsResponse response =
            MiradorAgentService.getAgentsBySkill(null);
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertEquals(0, response.agents.size());
    }

    @IsTest
    static void getSkillsByAgentReturnsList() {
        Test.startTest();
        MiradorAgentService.AgentSkillsResponse response =
            MiradorAgentService.getSkillsByAgent(UserInfo.getUserId());
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.skills);
    }

    @IsTest
    static void getSkillsByAgentNullReturnsEmpty() {
        Test.startTest();
        MiradorAgentService.AgentSkillsResponse response =
            MiradorAgentService.getSkillsByAgent(null);
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertEquals(0, response.skills.size());
    }

    @IsTest
    static void loadOmniEnabledUserIdsReturnsSet() {
        Test.startTest();
        Set<Id> userIds = MiradorAgentService.loadOmniEnabledUserIds();
        Test.stopTest();
        System.assertNotEquals(null, userIds);
    }

    @IsTest
    static void getPresenceStatusesReturnsCatalog() {
        Test.startTest();
        List<MiradorAgentService.PresenceStatusDto> statuses =
            MiradorAgentService.getPresenceStatuses();
        Test.stopTest();
        System.assertNotEquals(null, statuses);
        // Every entry must carry an id and a label.
        for (MiradorAgentService.PresenceStatusDto s : statuses) {
            System.assertNotEquals(null, s.id, 'status needs an id');
            System.assertNotEquals(null, s.label, 'status needs a label');
        }
    }

    @IsTest
    static void snapshotIncludesPresenceStatusCatalog() {
        Test.startTest();
        MiradorSnapshotService.SnapshotResponse response =
            MiradorSnapshotService.getSnapshot('all');
        Test.stopTest();
        System.assertNotEquals(null, response.presenceStatuses,
            'snapshot must carry the presence status catalog');
    }

    @IsTest
    static void loadServiceResourceUserIdsReturnsSet() {
        Test.startTest();
        Set<Id> userIds = MiradorAgentService.loadServiceResourceUserIds();
        Test.stopTest();
        System.assertNotEquals(null, userIds);
    }

    /**
     * An active Service Resource of type Agent (Command Center for Service's
     * "offline service rep") must be surfaced by loadServiceResourceUserIds, even
     * when the user has no Omni-Channel presence. The running user has Customize
     * Application in tests, so read access on ServiceResource is satisfied.
     */
    @IsTest
    static void loadServiceResourceUserIdsIncludesActiveAgentResource() {
        User u = insertIsolatedUser();
        ServiceResource sr = new ServiceResource(
            Name = 'Mirador Offline Rep',
            RelatedRecordId = u.Id,
            ResourceType = 'A',
            IsActive = true
        );
        insert sr;

        Test.startTest();
        Set<Id> userIds = MiradorAgentService.loadServiceResourceUserIds();
        Test.stopTest();

        System.assert(
            userIds.contains(u.Id),
            'Active agent Service Resource should contribute its user'
        );
    }

    /**
     * With scope='all', a user backed only by an active agent Service Resource
     * (no Omni presence) is reported as an offline agent — the parity feature with
     * Command Center for Service's offline service reps.
     */
    @IsTest
    static void getAgentsAllScopeIncludesOfflineServiceResourceRep() {
        User u = insertIsolatedUser();
        insert new ServiceResource(
            Name = 'Mirador Offline Rep All',
            RelatedRecordId = u.Id,
            ResourceType = 'A',
            IsActive = true
        );

        Test.startTest();
        MiradorAgentService.AgentsResponse response = MiradorAgentService.getAgents('all');
        Test.stopTest();

        MiradorAgentService.AgentDto target = null;
        for (MiradorAgentService.AgentDto a : response.agents) {
            if (a.id == String.valueOf(u.Id)) {
                target = a;
            }
        }
        System.assertNotEquals(null, target, 'Offline Service Resource rep should appear in scope=all');
        System.assertEquals('offline', target.status, 'A rep with no presence is offline');
        System.assertEquals(null, target.presenceStatusId, 'Offline rep has no real presence status id');
        System.assertEquals(null, target.presenceStatusLabel, 'Offline rep has no real presence status label');
    }

    /**
     * An inactive agent Service Resource (or one of a non-agent type) must not be
     * surfaced — only Active + ResourceType='A' qualify.
     */
    @IsTest
    static void loadServiceResourceUserIdsExcludesInactiveAndNonAgent() {
        User inactive = insertIsolatedUser();
        insert new ServiceResource(
            Name = 'Mirador Inactive Rep',
            RelatedRecordId = inactive.Id,
            ResourceType = 'A',
            IsActive = false
        );
        User technician = insertIsolatedUser();
        insert new ServiceResource(
            Name = 'Mirador Technician Rep',
            RelatedRecordId = technician.Id,
            ResourceType = 'T',
            IsActive = true
        );

        Test.startTest();
        Set<Id> userIds = MiradorAgentService.loadServiceResourceUserIds();
        Test.stopTest();

        System.assert(!userIds.contains(inactive.Id), 'Inactive resource must be excluded');
        System.assert(!userIds.contains(technician.Id), 'Non-agent resource type must be excluded');
    }

    @IsTest
    static void getQueuesReturnsList() {
        Test.startTest();
        MiradorQueueService.QueuesResponse response = MiradorQueueService.getQueues();
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.queues);
    }

    @IsTest
    static void getQueuesPopulatesMetricsPerQueue() {
        Group q = new Group(Name = 'Mirador Metrics Queue', Type = 'Queue');
        insert q;

        Test.startTest();
        MiradorQueueService.QueuesResponse response = MiradorQueueService.getQueues();
        Test.stopTest();

        MiradorQueueService.QueueDto target = null;
        for (MiradorQueueService.QueueDto dto : response.queues) {
            if (dto.id == String.valueOf(q.Id)) {
                target = dto;
            }
        }
        System.assertNotEquals(null, target, 'Inserted queue should be returned');
        System.assertNotEquals(null, target.backlog);
        System.assertNotEquals(null, target.longest);
        System.assertNotEquals(null, target.avg);
        System.assertNotEquals(null, target.online);
        System.assert(target.backlog >= 0);
        System.assert(target.longest >= 0);
        System.assert(target.avg >= 0);
        System.assert(target.online >= 0);
    }

    /**
     * Build a PendingServiceRouting with otherwise read-only QueueId/CreatedDate
     * populated, by round-tripping through JSON. Lets the pure aggregation logic
     * be tested without inserting this non-insertable system object.
     */
    private static PendingServiceRouting buildPsr(Id queueId, Datetime createdDate) {
        Map<String, Object> raw = new Map<String, Object>{
            'attributes' => new Map<String, Object>{ 'type' => 'PendingServiceRouting' },
            'QueueId' => queueId == null ? null : String.valueOf(queueId),
            'CreatedDate' => createdDate
        };
        return (PendingServiceRouting) JSON.deserialize(
            JSON.serialize(raw), PendingServiceRouting.class
        );
    }

    @IsTest
    static void aggregateBacklogComputesCountLongestAndAvg() {
        Id queueA = '00G000000000001AAA';
        Id queueB = '00G000000000002AAA';
        Datetime nowDt = System.now();

        List<PendingServiceRouting> pending = new List<PendingServiceRouting>{
            buildPsr(queueA, nowDt.addSeconds(-60)),
            buildPsr(queueA, nowDt.addSeconds(-180)),
            buildPsr(queueB, nowDt.addSeconds(-30)),
            buildPsr(null, nowDt.addSeconds(-999))
        };

        Test.startTest();
        Map<Id, MiradorQueueService.BacklogStats> stats =
            MiradorQueueService.aggregateBacklog(pending, nowDt);
        Test.stopTest();

        System.assertEquals(2, stats.size(), 'Null-queue rows must be ignored');
        MiradorQueueService.BacklogStats a = stats.get(queueA);
        System.assertEquals(2, a.count);
        System.assertEquals(180, a.longestSec);
        System.assertEquals(120, a.avgSec, 'avg of 60 and 180 is 120');
        MiradorQueueService.BacklogStats b = stats.get(queueB);
        System.assertEquals(1, b.count);
        System.assertEquals(30, b.longestSec);
        System.assertEquals(30, b.avgSec);
    }

    @IsTest
    static void aggregateBacklogEmptyYieldsNoStats() {
        Map<Id, MiradorQueueService.BacklogStats> stats =
            MiradorQueueService.aggregateBacklog(new List<PendingServiceRouting>(), System.now());
        System.assertEquals(0, stats.size());
    }

    @IsTest
    static void countOnlinePerQueueTalliesMembership() {
        String queueA = '00G000000000001AAA';
        String queueB = '00G000000000002AAA';
        Map<Id, List<String>> membership = new Map<Id, List<String>>{
            '005000000000001AAA' => new List<String>{ queueA, queueB },
            '005000000000002AAA' => new List<String>{ queueA },
            '005000000000003AAA' => null
        };

        Test.startTest();
        Map<Id, Integer> onlineByQueue = MiradorQueueService.countOnlinePerQueue(membership);
        Test.stopTest();

        System.assertEquals(2, onlineByQueue.get((Id) queueA), 'Two online agents in queue A');
        System.assertEquals(1, onlineByQueue.get((Id) queueB), 'One online agent in queue B');
    }

    @IsTest
    static void isOnlineStatusClassifiesLabels() {
        System.assertEquals(true, MiradorQueueService.isOnlineStatus('Available'));
        System.assertEquals(false, MiradorQueueService.isOnlineStatus('Busy'));
        System.assertEquals(false, MiradorQueueService.isOnlineStatus('On Break'));
        System.assertEquals(false, MiradorQueueService.isOnlineStatus('Offline'));
        System.assertEquals(false, MiradorQueueService.isOnlineStatus(null));
    }

    @IsTest
    static void secondsSinceClampsNullAndNegative() {
        Datetime nowDt = System.now();
        System.assertEquals(0, MiradorQueueService.secondsSince(nowDt, null));
        System.assertEquals(0, MiradorQueueService.secondsSince(nowDt, nowDt.addSeconds(60)));
        Integer elapsed = MiradorQueueService.secondsSince(nowDt, nowDt.addSeconds(-120));
        System.assert(elapsed >= 119 && elapsed <= 121, 'Expected ~120s, got ' + elapsed);
    }

    /* ───────── Work service ───────── */

    @IsTest
    static void getWorkReturnsList() {
        Test.startTest();
        MiradorWorkService.WorkResponse response = MiradorWorkService.getWork();
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.work);
    }

    @IsTest
    static void workIsCaseIdRecognizesCasePrefix() {
        System.assertEquals(true, MiradorWorkService.isCaseId('500000000000001AAA'));
        System.assertEquals(false, MiradorWorkService.isCaseId('0Bz000000000001AAA'));
        System.assertEquals(false, MiradorWorkService.isCaseId(null));
    }

    @IsTest
    static void workSubjectForPrefersCaseSubjectThenNumberThenChannel() {
        Id caseId = '500000000000001AAA';
        Case withSubject = (Case) JSON.deserialize(
            '{"attributes":{"type":"Case"},"Id":"' + caseId + '","CaseNumber":"00042","Subject":"Broken thing"}',
            Case.class
        );
        Case noSubject = (Case) JSON.deserialize(
            '{"attributes":{"type":"Case"},"Id":"' + caseId + '","CaseNumber":"00042"}',
            Case.class
        );

        Map<Id, Case> withSub = new Map<Id, Case>{ caseId => withSubject };
        Map<Id, Case> noSub = new Map<Id, Case>{ caseId => noSubject };

        System.assertEquals('Broken thing', MiradorWorkService.subjectFor(caseId, withSub, 'Phone'));
        System.assertEquals('00042', MiradorWorkService.subjectFor(caseId, noSub, 'Phone'));
        System.assertEquals('Phone', MiradorWorkService.subjectFor(null, new Map<Id, Case>(), 'Phone'));
        System.assertEquals('Work item', MiradorWorkService.subjectFor(null, new Map<Id, Case>(), null));
    }

    @IsTest
    static void workSecondsSinceClampsNullAndNegative() {
        Datetime nowDt = System.now();
        System.assertEquals(0, MiradorWorkService.secondsSince(nowDt, null));
        System.assertEquals(0, MiradorWorkService.secondsSince(nowDt, nowDt.addSeconds(60)));
        Integer elapsed = MiradorWorkService.secondsSince(nowDt, nowDt.addSeconds(-90));
        System.assert(elapsed >= 89 && elapsed <= 91, 'Expected ~90s, got ' + elapsed);
    }

    private static AgentWork buildAgentWork(Id workItemId, Id userId, Id queueId, Datetime requestDt) {
        Map<String, Object> raw = new Map<String, Object>{
            'attributes' => new Map<String, Object>{ 'type' => 'AgentWork' },
            'Id' => '0Bz000000000001AAA',
            'WorkItemId' => workItemId == null ? null : String.valueOf(workItemId),
            'UserId' => userId == null ? null : String.valueOf(userId),
            'OriginalQueueId' => queueId == null ? null : String.valueOf(queueId),
            'RequestDateTime' => requestDt
        };
        return (AgentWork) JSON.deserialize(JSON.serialize(raw), AgentWork.class);
    }

    private static PendingServiceRouting buildPendingRouting(Id workItemId, Id queueId, Datetime createdDt) {
        Map<String, Object> raw = new Map<String, Object>{
            'attributes' => new Map<String, Object>{ 'type' => 'PendingServiceRouting' },
            'Id' => '0JR000000000001AAA',
            'WorkItemId' => workItemId == null ? null : String.valueOf(workItemId),
            'QueueId' => queueId == null ? null : String.valueOf(queueId),
            'CreatedDate' => createdDt
        };
        return (PendingServiceRouting) JSON.deserialize(JSON.serialize(raw), PendingServiceRouting.class);
    }

    @IsTest
    static void buildAssignedItemsMapsAgentWork() {
        Datetime nowDt = System.now();
        Id caseId = '500000000000001AAA';
        Id userId = '005000000000001AAA';
        Id queueId = '00G000000000001AAA';
        Case c = (Case) JSON.deserialize(
            '{"attributes":{"type":"Case"},"Id":"' + caseId + '","CaseNumber":"00099","Subject":"Down"}',
            Case.class
        );
        Map<Id, Case> caseById = new Map<Id, Case>{ caseId => c };
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName =
            MiradorObjectIconUtil.forObjectApiNames(new Set<String>{ 'Case' });

        List<AgentWork> assigned = new List<AgentWork>{
            buildAgentWork(caseId, userId, queueId, nowDt.addSeconds(-120))
        };

        Test.startTest();
        List<MiradorWorkService.WorkItemDto> items =
            MiradorWorkService.buildAssignedItems(assigned, caseById, nowDt, iconsByApiName);
        Test.stopTest();

        System.assertEquals(1, items.size());
        MiradorWorkService.WorkItemDto dto = items[0];
        System.assertEquals('assigned', dto.status);
        System.assertEquals(String.valueOf(userId), dto.agentId);
        System.assertEquals(String.valueOf(queueId), dto.queueId);
        System.assertEquals('Down', dto.subject);
        System.assertEquals(String.valueOf(caseId), dto.workItemId);
        System.assertEquals('Case', dto.objectApiName);
        System.assertNotEquals(null, dto.iconName);
        System.assertEquals('standard', dto.iconSprite);
        System.assertEquals('case', dto.iconSymbol);
        System.assert(dto.ageSec >= 119 && dto.ageSec <= 121, 'Expected ~120s, got ' + dto.ageSec);
    }

    @IsTest
    static void buildQueuedItemsMapsPendingRouting() {
        Datetime nowDt = System.now();
        Id queueId = '00G000000000002AAA';

        List<PendingServiceRouting> pending = new List<PendingServiceRouting>{
            buildPendingRouting(null, queueId, nowDt.addSeconds(-45))
        };
        Map<String, MiradorObjectIconUtil.IconDescriptor> iconsByApiName = new Map<String, MiradorObjectIconUtil.IconDescriptor>();

        Test.startTest();
        List<MiradorWorkService.WorkItemDto> items =
            MiradorWorkService.buildQueuedItems(pending, new Map<Id, Case>(), nowDt, iconsByApiName);
        Test.stopTest();

        System.assertEquals(1, items.size());
        MiradorWorkService.WorkItemDto dto = items[0];
        System.assertEquals('queued', dto.status);
        System.assertEquals(null, dto.agentId);
        System.assertEquals(String.valueOf(queueId), dto.queueId);
        System.assertEquals('Work item', dto.subject, 'No case and no channel label falls back to Work item');
        System.assertEquals('standard:case', dto.iconName);
        System.assertEquals('standard', dto.iconSprite);
        System.assertEquals('case', dto.iconSymbol);
        System.assert(dto.ageSec >= 44 && dto.ageSec <= 46, 'Expected ~45s, got ' + dto.ageSec);
    }

    @IsTest
    static void objectIconUtilParsesTabIconUrls() {
        MiradorObjectIconUtil.IconDescriptor caseIcon = MiradorObjectIconUtil.fromIconUrl(
            'https://example.com/img/icon/t4v35/standard/case.svg', 'Case'
        );
        System.assertEquals('Case', caseIcon.objectApiName);
        System.assertEquals('standard:case', caseIcon.iconName);
        System.assertEquals('standard', caseIcon.sprite);
        System.assertEquals('case', caseIcon.symbol);

        MiradorObjectIconUtil.IconDescriptor customIcon = MiradorObjectIconUtil.fromIconUrl(
            'https://example.com/img/icon/t4v35/custom/custom78.svg', 'MyObject__c'
        );
        System.assertEquals('custom:custom78', customIcon.iconName);
        System.assertEquals('custom', customIcon.sprite);
        System.assertEquals('custom78', customIcon.symbol);

        MiradorObjectIconUtil.IconDescriptor voiceIcon = MiradorObjectIconUtil.fromIconUrl(
            'https://example.com/img/icon/t4v35/standard/call.svg', 'VoiceCall'
        );
        System.assertEquals('standard:call', voiceIcon.iconName);
    }

    @IsTest
    static void objectIconUtilFallbackForCustomWithoutTab() {
        MiradorObjectIconUtil.IconDescriptor icon =
            MiradorObjectIconUtil.fallbackForApiName('MyObject__c');
        System.assertEquals('custom:custom63', icon.iconName);
    }

    @IsTest
    static void objectIconUtilCamelToSnake() {
        System.assertEquals('live_chat', MiradorObjectIconUtil.camelToSnake('LiveChat'));
        System.assertEquals('voice_call', MiradorObjectIconUtil.camelToSnake('VoiceCall'));
    }

    /* ───────── Skills service ───────── */

    @IsTest
    static void getSkillsReturnsList() {
        Test.startTest();
        MiradorSkillService.SkillsResponse response = MiradorSkillService.getSkills();
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.skills);
    }

    /**
     * The Skill loop body in getSkills (building DTOs, merging per-skill metrics)
     * cannot be exercised by inserting Skill — DML insert is not allowed on it,
     * and the org may have no skills. Cover that logic via the pure tally helper
     * (countBacklogTalliesReadyRequirementsBySkill) plus this DTO-shape check.
     */
    @IsTest
    static void skillDtoHoldsCatalogShape() {
        MiradorSkillService.SkillDto dto = new MiradorSkillService.SkillDto();
        dto.id = '0C5000000000001AAA';
        dto.name = 'Català';
        dto.agents = 3;
        dto.backlog = 7;
        System.assertEquals('Català', dto.name);
        System.assertEquals(3, dto.agents);
        System.assertEquals(7, dto.backlog);
    }

    /**
     * Build a SkillRequirement with read-only SkillId/RelatedRecordId populated
     * via JSON round-trip, so the pure backlog tally can be tested without the
     * routing system objects.
     */
    private static SkillRequirement buildSkillReq(Id skillId, Id relatedRecordId) {
        Map<String, Object> raw = new Map<String, Object>{
            'attributes' => new Map<String, Object>{ 'type' => 'SkillRequirement' },
            'SkillId' => skillId == null ? null : String.valueOf(skillId),
            'RelatedRecordId' => relatedRecordId == null ? null : String.valueOf(relatedRecordId)
        };
        return (SkillRequirement) JSON.deserialize(JSON.serialize(raw), SkillRequirement.class);
    }

    private static ServiceResourceSkill buildResourceSkill(Id skillId, Id resourceId) {
        Map<String, Object> raw = new Map<String, Object>{
            'attributes' => new Map<String, Object>{ 'type' => 'ServiceResourceSkill' },
            'SkillId' => skillId == null ? null : String.valueOf(skillId),
            'ServiceResourceId' => resourceId == null ? null : String.valueOf(resourceId)
        };
        return (ServiceResourceSkill) JSON.deserialize(JSON.serialize(raw), ServiceResourceSkill.class);
    }

    @IsTest
    static void countAgentsTalliesDistinctResourcesBySkill() {
        Id skillA = '0C5000000000001AAA';
        Id skillB = '0C5000000000002AAA';
        Id res1 = '0Hn000000000001AAA';
        Id res2 = '0Hn000000000002AAA';

        List<ServiceResourceSkill> assignments = new List<ServiceResourceSkill>{
            buildResourceSkill(skillA, res1),
            buildResourceSkill(skillA, res1), // duplicate resource → counted once
            buildResourceSkill(skillA, res2),
            buildResourceSkill(skillB, res1),
            buildResourceSkill(null, res1),   // ignored (no skill)
            buildResourceSkill(skillB, null)  // ignored (no resource)
        };

        Test.startTest();
        Map<Id, Integer> bySkill = MiradorSkillService.countAgents(assignments);
        Test.stopTest();

        System.assertEquals(2, bySkill.get(skillA), 'Two distinct resources for skill A');
        System.assertEquals(1, bySkill.get(skillB), 'One resource for skill B');
    }

    @IsTest
    static void diffSkillsAddsRemovesAndUpdates() {
        Id resourceId = '0Hn000000000001AAA';
        Id skillKeep = '0C5000000000001AAA';
        Id skillDrop = '0C5000000000002AAA';
        Id skillAdd  = '0C5000000000003AAA';

        ServiceResourceSkill keep = buildResourceSkill(skillKeep, resourceId); // level change
        ServiceResourceSkill drop = buildResourceSkill(skillDrop, resourceId); // removed
        // give the existing rows ids + level via JSON so update/delete can target them
        keep = (ServiceResourceSkill) JSON.deserialize(
            '{"attributes":{"type":"ServiceResourceSkill"},"Id":"0Hq000000000001AAA","SkillId":"' + skillKeep + '","ServiceResourceId":"' + resourceId + '","SkillLevel":1}',
            ServiceResourceSkill.class);
        drop = (ServiceResourceSkill) JSON.deserialize(
            '{"attributes":{"type":"ServiceResourceSkill"},"Id":"0Hq000000000002AAA","SkillId":"' + skillDrop + '","ServiceResourceId":"' + resourceId + '","SkillLevel":3}',
            ServiceResourceSkill.class);

        List<ServiceResourceSkill> current = new List<ServiceResourceSkill>{ keep, drop };
        List<MiradorSkillService.SkillChange> desired = new List<MiradorSkillService.SkillChange>();
        MiradorSkillService.SkillChange c1 = new MiradorSkillService.SkillChange();
        c1.skillId = skillKeep; c1.level = 5; c1.remove = false;        // update level 1 -> 5
        MiradorSkillService.SkillChange c2 = new MiradorSkillService.SkillChange();
        c2.skillId = skillDrop; c2.remove = true;                       // delete
        MiradorSkillService.SkillChange c3 = new MiradorSkillService.SkillChange();
        c3.skillId = skillAdd; c3.level = 2; c3.remove = false;         // insert
        desired.add(c1); desired.add(c2); desired.add(c3);

        MiradorSkillService.SkillDiff diff = MiradorSkillService.diffSkills(current, desired, resourceId);

        System.assertEquals(1, diff.toInsert.size(), 'one new skill');
        System.assertEquals(skillAdd, diff.toInsert[0].SkillId);
        System.assertEquals(1, diff.toUpdate.size(), 'one level change');
        System.assertEquals(5, diff.toUpdate[0].SkillLevel);
        System.assertEquals(1, diff.toDelete.size(), 'one removal');
        System.assertEquals('0Hq000000000002AAA', String.valueOf(diff.toDelete[0].Id));
    }

    @IsTest
    static void countBacklogTalliesReadyRequirementsBySkill() {
        Id skillA = '0C5000000000001AAA';
        Id skillB = '0C5000000000002AAA';
        Id psrReady = '0JR000000000001AAA';
        Id psrNotReady = '0JR000000000002AAA';

        List<SkillRequirement> reqs = new List<SkillRequirement>{
            buildSkillReq(skillA, psrReady),     // counts
            buildSkillReq(skillA, psrNotReady),  // excluded (PSR not ready)
            buildSkillReq(skillB, psrReady),     // counts
            buildSkillReq(skillB, null),         // counts (no PSR filter)
            buildSkillReq(null, psrReady)        // ignored (no skill)
        };
        Set<Id> ready = new Set<Id>{ psrReady };

        Test.startTest();
        Map<Id, Integer> bySkill = MiradorSkillService.countBacklog(reqs, ready);
        Test.stopTest();

        System.assertEquals(1, bySkill.get(skillA), 'Only the ready PSR counts for skill A');
        System.assertEquals(2, bySkill.get(skillB), 'Ready PSR plus null-PSR requirement count for skill B');
    }

    /* ───────── Snapshot service ───────── */

    @IsTest
    static void getSnapshotReturnsAllDomains() {
        Test.startTest();
        MiradorSnapshotService.SnapshotResponse response =
            MiradorSnapshotService.getSnapshot('all');
        Test.stopTest();
        System.assertNotEquals(null, response);
        System.assertNotEquals(null, response.agents);
        System.assertNotEquals(null, response.queues);
        System.assertNotEquals(null, response.skills);
        System.assertNotEquals(null, response.work);
    }

    @IsTest
    static void getSnapshotScopeConnected() {
        Test.startTest();
        MiradorSnapshotService.SnapshotResponse connected =
            MiradorSnapshotService.getSnapshot('connected');
        MiradorSnapshotService.SnapshotResponse all =
            MiradorSnapshotService.getSnapshot('all');
        Test.stopTest();
        System.assertNotEquals(null, connected.agents);
        System.assertNotEquals(null, all.agents);
        System.assert(
            all.agents.size() >= connected.agents.size(),
            'all scope should include at least as many agents as connected'
        );
    }

    @IsTest
    static void loadContextSharesDataAcrossDomains() {
        Test.startTest();
        MiradorLoadContext ctx = MiradorLoadContext.load();
        Test.stopTest();
        System.assertNotEquals(null, ctx.presenceByUser);
        System.assertNotEquals(null, ctx.activeAgentWork);
        System.assertNotEquals(null, ctx.pendingRouting);
        System.assertNotEquals(null, ctx.casesById);
        System.assertNotEquals(null, ctx.readyPsrIds());
    }
}