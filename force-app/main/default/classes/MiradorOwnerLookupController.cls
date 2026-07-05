/**
 * Read-only search backing the owner-reassign quick action. Returns a single
 * unified list of candidate owners — active users and queues — so a record's
 * OwnerId can be reassigned from one combined lookup. The actual reassignment is
 * done client-side via Lightning Data Service (updateRecord); this class never
 * performs DML.
 */
public with sharing class MiradorOwnerLookupController {
    /** One selectable owner: either a User or a Queue (Group with Type='Queue'). */
    public class OwnerResult {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String label;
        /** Secondary line: username for users, DeveloperName for queues. */
        @AuraEnabled
        public String sublabel;
        /** 'user' or 'queue' — drives the icon and grouping in the UI. */
        @AuraEnabled
        public String type;
        /** Lightning icon name, e.g. standard:user or standard:groups. */
        @AuraEnabled
        public String iconName;
    }

    private static final Integer PER_TYPE_LIMIT = 25;

    /**
     * Search users and queues by name for the owner lookup.
     *
     * @param searchTerm Free text; matched against name fields. Blank returns a
     *                   default page of alphabetical results.
     * @param includeUsers  When false, users are omitted (e.g. a record whose
     *                      object cannot be owned by a user).
     * @param includeQueues When false, queues are omitted.
     */
    @AuraEnabled(cacheable=true)
    public static List<OwnerResult> search(
        String searchTerm,
        Boolean includeUsers,
        Boolean includeQueues
    ) {
        Boolean wantUsers = includeUsers == null ? true : includeUsers;
        Boolean wantQueues = includeQueues == null ? true : includeQueues;

        List<OwnerResult> results = new List<OwnerResult>();
        if (wantUsers) {
            results.addAll(searchUsers(searchTerm));
        }
        if (wantQueues) {
            results.addAll(searchQueues(searchTerm));
        }
        return results;
    }

    private static List<OwnerResult> searchUsers(String searchTerm) {
        List<OwnerResult> results = new List<OwnerResult>();
        String sLike = toLikePattern(searchTerm);

        List<User> users = [
            SELECT Id, Name, Username
            FROM User
            WHERE IsActive = TRUE
            AND (Name LIKE :sLike OR Username LIKE :sLike)
            ORDER BY Name
            LIMIT :PER_TYPE_LIMIT
        ];
        for (User u : users) {
            results.add(userResult(u.Id, u.Name, u.Username));
        }
        return results;
    }

    private static List<OwnerResult> searchQueues(String searchTerm) {
        List<OwnerResult> results = new List<OwnerResult>();
        String sLike = toLikePattern(searchTerm);

        List<Group> queues = [
            SELECT Id, Name, DeveloperName
            FROM Group
            WHERE Type = 'Queue'
            AND (Name LIKE :sLike OR DeveloperName LIKE :sLike)
            ORDER BY Name
            LIMIT :PER_TYPE_LIMIT
        ];
        for (Group g : queues) {
            results.add(queueResult(g.Id, g.Name, g.DeveloperName));
        }
        return results;
    }

    /**
     * Default page for the lookup when no search term is entered: the current
     * user's recently viewed users (most-recent first) followed by all queues.
     *
     * Queues never appear in RecentlyViewed — they are managed from Setup, which
     * records no recently-viewed entry — so there is no "recent queue" signal to
     * use. All queues are listed instead (orgs have few enough for that to be
     * practical), keeping them reachable without typing.
     */
    @AuraEnabled(cacheable=true)
    public static List<OwnerResult> getRecentOwners(
        Boolean includeUsers,
        Boolean includeQueues
    ) {
        Boolean wantUsers = includeUsers == null ? true : includeUsers;
        Boolean wantQueues = includeQueues == null ? true : includeQueues;

        List<OwnerResult> results = new List<OwnerResult>();

        if (wantUsers) {
            for (RecentlyViewed rv : [
                SELECT Id, Name
                FROM RecentlyViewed
                WHERE Type = 'User'
                ORDER BY LastViewedDate DESC
                LIMIT :PER_TYPE_LIMIT
            ]) {
                results.add(userResult(rv.Id, rv.Name, null));
            }
        }

        if (wantQueues) {
            // Empty term → searchQueues returns all queues, ordered by name.
            results.addAll(searchQueues(''));
        }

        return results;
    }

    private static OwnerResult userResult(Id userId, String name, String username) {
        OwnerResult r = new OwnerResult();
        r.id = userId;
        r.label = name;
        r.sublabel = username;
        r.type = 'user';
        r.iconName = 'standard:user';
        return r;
    }

    private static OwnerResult queueResult(Id queueId, String name, String developerName) {
        OwnerResult r = new OwnerResult();
        r.id = queueId;
        r.label = name;
        r.sublabel = developerName;
        r.type = 'queue';
        r.iconName = 'standard:queue';
        return r;
    }

    /**
     * Build a case-insensitive contains-pattern, escaping SOQL LIKE wildcards in
     * the user's input so '%' and '_' are matched literally.
     */
    @TestVisible
    private static String toLikePattern(String searchTerm) {
        String term = searchTerm == null ? '' : searchTerm.trim();
        String escaped = term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_');
        return '%' + escaped + '%';
    }
}
