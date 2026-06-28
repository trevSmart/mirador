public with sharing class MiradorAgentService {
    public class WorkItemDto {
        public String id;
        public String recordId;
        public String label;
        public String subject;
        public String channel;
        public String channelKey;
        public String status;
        public String queue;
        public String queueId;
        public Integer ageMin;
    }

    public class AgentDto {
        public String id;
        public String name;
        public String role;
        public String recordUrl;
        public String status;
        public String presenceStatusId;
        public String presenceStatusLabel;
        public Integer max;
        public Integer used;
        public List<String> queueIds;
        public Integer loginMin;
        public String photo;
        public Map<String, Integer> chans;
        public List<WorkItemDto> work;
        public List<AgentSkillDto> skills;
    }

    public class AgentsResponse {
        public List<AgentDto> agents;
    }

    /** A presence status configured in the org (Setup → Presence Statuses). */
    public class PresenceStatusDto {
        public String id;
        public String label;
    }

    public class AgentSkillDto {
        public String id;
        public String skillId;
        public String name;
        public String type;
        public Double level;
        public Datetime startDate;
        public Datetime lastModifiedDate;
        public String lastModifiedBy;
    }

    public class AgentSkillsResponse {
        public List<AgentSkillDto> skills;
    }

    /**
     * Default scope: only agents currently connected to Omni-Channel.
     */
    public static AgentsResponse getAgents() {
        return getAgents('connected');
    }

    /**
     * @param scope 'connected' (default) returns agents with a current Omni-Channel
     *        presence. 'all' returns every Omni-enabled agent plus every active
     *        Service Resource of type Agent (connected or not); agents without a
     *        current presence are reported as offline. This mirrors Command Center
     *        for Service, which derives offline service reps from Service Resource.
     */
    public static AgentsResponse getAgents(String scope) {
        MiradorLoadContext ctx = MiradorLoadContext.load();
        AgentsResponse response = new AgentsResponse();
        response.agents = buildAgentsFromContext(ctx, scope);
        return response;
    }

    /**
     * Agents qualified for a skill. Each qualified agent is a ServiceResource
     * (RelatedRecordId → User) linked to the skill via ServiceResourceSkill;
     * reported with the same presence/work shape as getAgents so the client can
     * reuse the agent card and drawer.
     * @param skillId the Skill Id to look up
     */
    public static AgentsResponse getAgentsBySkill(Id skillId) {
        AgentsResponse response = new AgentsResponse();
        response.agents = new List<AgentDto>();
        if (skillId == null) {
            return response;
        }

        Set<Id> userIds = new Set<Id>();
        for (ServiceResourceSkill srs : [
            SELECT ServiceResource.RelatedRecordId
            FROM ServiceResourceSkill
            WHERE SkillId = :skillId AND ServiceResource.IsActive = true
            LIMIT 10000
        ]) {
            Id userId = srs.ServiceResource?.RelatedRecordId;
            if (userId != null && String.valueOf(userId).startsWith('005')) {
                userIds.add(userId);
            }
        }
        if (userIds.isEmpty()) {
            return response;
        }

        MiradorLoadContext ctx = MiradorLoadContext.load();
        response.agents = buildAgentDtos(userIds, ctx.presenceByUser, ctx);
        return response;
    }

    /**
     * Skills assigned to an agent, with the ServiceResourceSkill relationship
     * metadata (level, start date, last-modified audit). The agent is resolved
     * through its ServiceResource (RelatedRecordId → User).
     * @param userId the agent's User Id
     */
    public static AgentSkillsResponse getSkillsByAgent(Id userId) {
        AgentSkillsResponse response = new AgentSkillsResponse();
        response.skills = new List<AgentSkillDto>();
        if (userId == null) {
            return response;
        }

        Map<Id, List<AgentSkillDto>> skillsByUser = loadSkillsByUser(new Set<Id>{ userId });
        if (skillsByUser.containsKey(userId)) {
            response.skills = skillsByUser.get(userId);
        }
        return response;
    }

    /**
     * Skills assigned to a set of agents, keyed by User Id, sharing the same
     * ServiceResourceSkill query and DTO mapping as getSkillsByAgent so the
     * embedded-on-/agents shape matches the standalone endpoint. Resolved through
     * each agent's ServiceResource (RelatedRecordId → User).
     */
    private static Map<Id, List<AgentSkillDto>> loadSkillsByUser(Set<Id> userIds) {
        Map<Id, List<AgentSkillDto>> byUser = new Map<Id, List<AgentSkillDto>>();
        if (userIds == null || userIds.isEmpty()) {
            return byUser;
        }

        for (ServiceResourceSkill srs : [
            SELECT SkillId, Skill.MasterLabel, Skill.Type.MasterLabel,
                   SkillLevel, EffectiveStartDate,
                   LastModifiedDate, LastModifiedBy.Name,
                   ServiceResource.RelatedRecordId
            FROM ServiceResourceSkill
            WHERE ServiceResource.RelatedRecordId IN :userIds
            ORDER BY Skill.MasterLabel
            LIMIT 10000
        ]) {
            Id ownerId = srs.ServiceResource?.RelatedRecordId;
            if (ownerId == null) {
                continue;
            }
            AgentSkillDto dto = new AgentSkillDto();
            dto.id = String.valueOf(srs.Id);
            dto.skillId = srs.SkillId == null ? null : String.valueOf(srs.SkillId);
            dto.name = srs.Skill?.MasterLabel;
            dto.type = srs.Skill?.Type?.MasterLabel;
            dto.level = srs.SkillLevel;
            dto.startDate = srs.EffectiveStartDate;
            dto.lastModifiedDate = srs.LastModifiedDate;
            dto.lastModifiedBy = srs.LastModifiedBy?.Name;
            if (!byUser.containsKey(ownerId)) {
                byUser.put(ownerId, new List<AgentSkillDto>());
            }
            byUser.get(ownerId).add(dto);
        }
        return byUser;
    }

    /**
     * Build the agent roster from a pre-loaded context (shared by /snapshot).
     */
    public static List<AgentDto> buildAgentsFromContext(MiradorLoadContext ctx, String scope) {
        Boolean includeAll = scope != null && scope.equalsIgnoreCase('all');
        Set<Id> userIds = new Set<Id>(ctx.presenceByUser.keySet());
        if (includeAll) {
            userIds.addAll(loadOmniEnabledUserIds());
            userIds.addAll(loadServiceResourceUserIds());
        }
        return buildAgentDtos(userIds, ctx.presenceByUser, ctx);
    }

    /**
     * Build agent DTOs for a set of users, hydrating presence, active work,
     * channel counts and queue membership. Shared by getAgents and
     * getAgentsBySkill so both surface identical agent shapes.
     */
    private static List<AgentDto> buildAgentDtos(
        Set<Id> userIds,
        Map<Id, UserServicePresence> presenceByUser,
        MiradorLoadContext ctx
    ) {
        List<AgentDto> result = new List<AgentDto>();
        if (userIds.isEmpty()) {
            return result;
        }

        Map<Id, List<WorkItemDto>> workByUser = workItemsByUserFromContext(ctx);
        String orgUrl = Url.getOrgDomainUrl().toExternalForm();
        Map<Id, List<String>> queueIdsByUser = loadQueueIdsByUser(userIds);
        Map<Id, List<AgentSkillDto>> skillsByUser = loadSkillsByUser(userIds);
        Map<Id, User> userById = new Map<Id, User>([
            SELECT Id, Name, Title, SmallPhotoUrl
            FROM User
            WHERE Id IN :userIds
            ORDER BY Name
        ]);

        for (User u : userById.values()) {
            UserServicePresence usp = presenceByUser.get(u.Id);

            AgentDto dto = new AgentDto();
            dto.id = String.valueOf(u.Id);
            dto.name = u.Name;
            dto.role = String.isBlank(u.Title) ? 'Agent' : u.Title;
            dto.recordUrl = buildRecordUrl(orgUrl, u.Id);
            dto.status = usp == null
                ? 'offline'
                : mapPresenceStatus(
                    usp.ServicePresenceStatus?.DeveloperName,
                    usp.ServicePresenceStatus?.MasterLabel
                );
            dto.presenceStatusId = usp?.ServicePresenceStatusId == null
                ? null
                : String.valueOf(usp.ServicePresenceStatusId);
            dto.presenceStatusLabel = usp == null
                ? null
                : usp.ServicePresenceStatus?.MasterLabel;
            dto.max = usp != null && usp.ConfiguredCapacity != null && usp.ConfiguredCapacity > 0
                ? Integer.valueOf(usp.ConfiguredCapacity)
                : 5;
            List<WorkItemDto> items = workByUser.containsKey(u.Id)
                ? workByUser.get(u.Id)
                : new List<WorkItemDto>();
            dto.work = items;
            dto.used = items.size();
            dto.chans = buildChannelCounts(items);
            dto.queueIds = mergeQueueIds(
                queueIdsByUser.containsKey(u.Id)
                    ? queueIdsByUser.get(u.Id)
                    : new List<String>(),
                items
            );
            dto.loginMin = usp == null ? 0 : minutesSince(usp.StatusStartDate);
            dto.photo = buildPhotoUrl(orgUrl, u.SmallPhotoUrl);
            dto.skills = skillsByUser.containsKey(u.Id)
                ? skillsByUser.get(u.Id)
                : new List<AgentSkillDto>();
            result.add(dto);
        }

        return result;
    }

    /**
     * User ids enabled for Omni-Channel: assigned to any presence configuration
     * directly (PresenceUserConfigUser) or through their profile
     * (PresenceUserConfigProfile).
     */
    @TestVisible
    private static Set<Id> loadOmniEnabledUserIds() {
        Set<Id> userIds = new Set<Id>();

        for (PresenceUserConfigUser assignment : [
            SELECT UserId FROM PresenceUserConfigUser LIMIT 5000
        ]) {
            if (assignment.UserId != null) {
                userIds.add(assignment.UserId);
            }
        }

        Set<Id> profileIds = new Set<Id>();
        for (PresenceUserConfigProfile assignment : [
            SELECT ProfileId FROM PresenceUserConfigProfile LIMIT 5000
        ]) {
            if (assignment.ProfileId != null) {
                profileIds.add(assignment.ProfileId);
            }
        }
        if (!profileIds.isEmpty()) {
            for (User u : [
                SELECT Id FROM User
                WHERE ProfileId IN :profileIds AND IsActive = true
                LIMIT 5000
            ]) {
                userIds.add(u.Id);
            }
        }

        return userIds;
    }

    /**
     * User ids derived from active Service Resources of type Agent — the offline
     * service reps Command Center for Service surfaces in its Agents tab. A user
     * with an Active Service Resource whose Resource Type is Agent shows up here
     * even if they never connected to Omni-Channel; buildAgentDtos reports them as
     * offline when they have no current presence.
     *
     * Gated on read access to ServiceResource, matching the standard product: a
     * supervisor without that permission gets no Service-Resource-derived reps.
     *
     * Note: Command Center for Service caps this at 1,000 records (and can show
     * inconsistent offline counts above that). We do not impose that 1,000 cap; a
     * 5,000 safety LIMIT (as in loadOmniEnabledUserIds) bounds the query instead.
     */
    @TestVisible
    private static Set<Id> loadServiceResourceUserIds() {
        Set<Id> userIds = new Set<Id>();
        if (!Schema.sObjectType.ServiceResource.isAccessible()) {
            return userIds;
        }

        for (ServiceResource sr : [
            SELECT RelatedRecordId
            FROM ServiceResource
            WHERE IsActive = true
              AND ResourceType = 'A'
              AND RelatedRecordId != null
            LIMIT 5000
        ]) {
            Id userId = sr.RelatedRecordId;
            if (userId != null && String.valueOf(userId).startsWith('005')) {
                userIds.add(userId);
            }
        }

        return userIds;
    }

    /**
     * The full catalog of presence statuses configured in the org, regardless of
     * whether any agent currently holds them. Drives the Home's per-status filter
     * chips (one chip per configured status). Only id + label: Salesforce does not
     * expose whether a status is "busy", so we don't classify them.
     */
    public static List<PresenceStatusDto> getPresenceStatuses() {
        if (!Schema.sObjectType.ServicePresenceStatus.isAccessible()) {
            return new List<PresenceStatusDto>();
        }
        List<PresenceStatusDto> result = new List<PresenceStatusDto>();
        for (ServicePresenceStatus sps : [
            SELECT Id, MasterLabel
            FROM ServicePresenceStatus
            ORDER BY MasterLabel
            LIMIT 1000
        ]) {
            PresenceStatusDto dto = new PresenceStatusDto();
            dto.id = String.valueOf(sps.Id);
            dto.label = sps.MasterLabel;
            result.add(dto);
        }
        return result;
    }

    @TestVisible
    private static Map<Id, List<String>> loadQueueIdsByUser(Set<Id> userIds) {
        return MiradorGroupMembership.loadQueueIdsByUser(userIds);
    }

    @TestVisible
    private static List<String> mergeQueueIds(List<String> membershipIds, List<WorkItemDto> workItems) {
        Set<String> merged = new Set<String>(membershipIds == null ? new List<String>() : membershipIds);
        if (workItems != null) {
            for (WorkItemDto item : workItems) {
                if (!String.isBlank(item.queueId)) {
                    merged.add(item.queueId);
                }
            }
        }
        return new List<String>(merged);
    }

    private static Map<Id, List<WorkItemDto>> workItemsByUserFromContext(MiradorLoadContext ctx) {
        Map<Id, List<WorkItemDto>> byUser = new Map<Id, List<WorkItemDto>>();
        for (AgentWork aw : ctx.activeAgentWork) {
            WorkItemDto item = new WorkItemDto();
            item.id = String.valueOf(aw.Id);
            item.recordId = aw.WorkItemId == null ? null : String.valueOf(aw.WorkItemId);
            item.channel = aw.ServiceChannel?.MasterLabel;
            item.channelKey = mapChannelKey(aw.ServiceChannel?.DeveloperName, aw.ServiceChannel?.MasterLabel);
            item.status = aw.Status;
            item.ageMin = minutesSince(aw.RequestDateTime);
            item.queueId = aw.OriginalQueueId == null ? null : String.valueOf(aw.OriginalQueueId);
            item.queue = aw.OriginalQueueId != null && ctx.queuesById.containsKey(aw.OriginalQueueId)
                ? ctx.queuesById.get(aw.OriginalQueueId).Name
                : null;

            if (aw.WorkItemId != null && ctx.casesById.containsKey(aw.WorkItemId)) {
                Case c = ctx.casesById.get(aw.WorkItemId);
                item.label = 'Case ' + c.CaseNumber;
                item.subject = c.Subject;
            } else {
                item.label = String.isBlank(item.channel) ? 'Work item' : item.channel;
                item.subject = null;
            }

            if (!byUser.containsKey(aw.UserId)) {
                byUser.put(aw.UserId, new List<WorkItemDto>());
            }
            byUser.get(aw.UserId).add(item);
        }
        return byUser;
    }

    private static Map<String, Integer> buildChannelCounts(List<WorkItemDto> items) {
        Map<String, Integer> chans = new Map<String, Integer>{
            'veu' => 0, 'chat' => 0, 'email' => 0, 'wa' => 0, 'cas' => 0
        };
        for (WorkItemDto item : items) {
            String key = String.isBlank(item.channelKey) ? 'cas' : item.channelKey;
            if (!chans.containsKey(key)) {
                chans.put(key, 0);
            }
            chans.put(key, chans.get(key) + 1);
        }
        return chans;
    }

    public static String mapChannelKey(String devName, String label) {
        String s = ((devName == null ? '' : devName) + ' ' + (label == null ? '' : label)).toLowerCase();
        if (s.contains('phone') || s.contains('voice') || s.contains('call')) {
            return 'veu';
        }
        if (s.contains('whatsapp')) {
            return 'wa';
        }
        if (s.contains('email') || s.contains('mail')) {
            return 'email';
        }
        if (s.contains('message') || s.contains('chat')) {
            return 'chat';
        }
        return 'cas';
    }

    @TestVisible
    private static String buildRecordUrl(String orgUrl, Id recordId) {
        if (String.isBlank(orgUrl) || recordId == null) {
            return null;
        }
        String base = orgUrl.endsWith('/') ? orgUrl.substring(0, orgUrl.length() - 1) : orgUrl;
        return base + '/' + String.valueOf(recordId);
    }

    @TestVisible
    private static String buildPhotoUrl(String orgUrl, String photoUrl) {
        if (String.isBlank(photoUrl)) {
            return null;
        }
        String trimmed = photoUrl.trim();
        String lower = trimmed.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) {
            return trimmed;
        }
        if (lower.startsWith('https//')) {
            return 'https://' + trimmed.substring(7);
        }
        if (lower.startsWith('http//')) {
            return 'http://' + trimmed.substring(6);
        }
        if (trimmed.startsWith('//')) {
            return 'https:' + trimmed;
        }
        String base = orgUrl.endsWith('/') ? orgUrl.substring(0, orgUrl.length() - 1) : orgUrl;
        if (trimmed.startsWith('/')) {
            return base + trimmed;
        }
        return base + '/' + trimmed;
    }

    /**
     * Normalize an Omni-Channel presence status into one of the four states the
     * UI understands: online | busy | away | offline.
     *
     * Classification prefers the status DeveloperName because it is a stable,
     * language-independent identifier; MasterLabel is a display label that can
     * be translated or renamed by the org. An unrecognized status defaults to
     * 'offline' (fail-safe): never report an unknown status as available, which
     * would hide an agent who is actually unreachable.
     */
    @TestVisible
    private static String mapPresenceStatus(String developerName, String masterLabel) {
        String classified = classifyPresence(developerName);
        if (classified == null) {
            classified = classifyPresence(masterLabel);
        }
        return classified == null ? 'offline' : classified;
    }

    @TestVisible
    private static String classifyPresence(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        String s = value.toLowerCase();
        if (s.contains('busy') || s.contains('occupied') || s.contains('ocupat') || s.contains('ocupad')) {
            return 'busy';
        }
        if (s.contains('away') || s.contains('break') || s.contains('absent')
            || s.contains('ausent') || s.contains('descans') || s.contains('pausa')) {
            return 'away';
        }
        // Check 'unavailable'/offline before 'available'/online so that
        // "Unavailable" is not swallowed by the 'available' substring match.
        if (s.contains('offline') || s.contains('unavailable')
            || s.contains('desconnect') || s.contains('desconect') || s.contains('no disponible')) {
            return 'offline';
        }
        if (s.contains('available') || s.contains('online')
            || s.contains('disponible') || s.contains('en linia') || s.contains('en línia')) {
            return 'online';
        }
        return null;
    }

    private static Integer minutesSince(Datetime startedAt) {
        if (startedAt == null) {
            return 0;
        }
        return Integer.valueOf((System.now().getTime() - startedAt.getTime()) / 60000);
    }
}