@IsTest
private class MiradorOwnerLookupControllerTest {
    @IsTest
    static void searchReturnsUsersAndQueues() {
        Test.startTest();
        List<MiradorOwnerLookupController.OwnerResult> results =
            MiradorOwnerLookupController.search('', true, true);
        Test.stopTest();

        Boolean sawUser = false;
        Boolean sawQueue = false;
        for (MiradorOwnerLookupController.OwnerResult r : results) {
            System.assertNotEquals(null, r.id, 'result must carry an id');
            System.assertNotEquals(null, r.label, 'result must carry a label');
            if (r.type == 'user') {
                sawUser = true;
                System.assertEquals('standard:user', r.iconName);
            } else if (r.type == 'queue') {
                sawQueue = true;
                System.assertEquals('standard:groups', r.iconName);
            } else {
                System.assert(false, 'unexpected owner type: ' + r.type);
            }
        }
        // The running user is always an active user, so at least one user matches.
        System.assert(sawUser, 'expected at least one user result');
        // A queue is set up in @TestSetup, so queues must appear too.
        System.assert(sawQueue, 'expected at least one queue result');
    }

    @IsTest
    static void includeFlagsFilterByType() {
        List<MiradorOwnerLookupController.OwnerResult> onlyQueues =
            MiradorOwnerLookupController.search('', false, true);
        for (MiradorOwnerLookupController.OwnerResult r : onlyQueues) {
            System.assertEquals('queue', r.type, 'users must be excluded');
        }

        List<MiradorOwnerLookupController.OwnerResult> onlyUsers =
            MiradorOwnerLookupController.search('', true, false);
        for (MiradorOwnerLookupController.OwnerResult r : onlyUsers) {
            System.assertEquals('user', r.type, 'queues must be excluded');
        }
    }

    @IsTest
    static void searchTermFiltersByName() {
        // The seeded queue has a unique developer name; searching for it should
        // return it while excluding non-matching users.
        List<MiradorOwnerLookupController.OwnerResult> results =
            MiradorOwnerLookupController.search('Mirador_Reassign_Test_Q', false, true);
        System.assertEquals(1, results.size(), 'exactly the seeded queue should match');
        System.assertEquals('queue', results[0].type);
    }

    @IsTest
    static void likePatternEscapesWildcards() {
        // Underscores and percents in user input must be matched literally, not
        // as SOQL wildcards.
        String pattern = MiradorOwnerLookupController.toLikePattern('a_b%c');
        System.assertEquals('%a\\_b\\%c%', pattern);
        System.assertEquals('%%', MiradorOwnerLookupController.toLikePattern(null));
    }

    @TestSetup
    static void seedQueue() {
        Group q = new Group(
            Name = 'Mirador Reassign Test Queue',
            DeveloperName = 'Mirador_Reassign_Test_Q',
            Type = 'Queue'
        );
        insert q;

        QueueSObject routing = new QueueSObject(
            QueueId = q.Id,
            SObjectType = 'Case'
        );
        insert routing;
    }
}
