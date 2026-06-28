/**
 * Aggregates agents, queues, skills and work in one response for dashboard refresh.
 */
public with sharing class MiradorSnapshotService {
    public class SnapshotResponse {
        public List<MiradorAgentService.AgentDto> agents;
        public List<MiradorQueueService.QueueDto> queues;
        public List<MiradorSkillService.SkillDto> skills;
        public List<MiradorWorkService.WorkItemDto> work;
        public List<MiradorAgentService.PresenceStatusDto> presenceStatuses;
    }

    public static SnapshotResponse getSnapshot(String scope) {
        MiradorLoadContext ctx = MiradorLoadContext.load();
        SnapshotResponse response = new SnapshotResponse();
        response.agents = MiradorAgentService.buildAgentsFromContext(ctx, scope);
        response.queues = MiradorQueueService.buildQueuesFromContext(ctx);
        response.skills = MiradorSkillService.buildSkillsFromContext(ctx);
        response.work = MiradorWorkService.buildWorkFromContext(ctx);
        response.presenceStatuses = MiradorAgentService.getPresenceStatuses();
        return response;
    }
}
