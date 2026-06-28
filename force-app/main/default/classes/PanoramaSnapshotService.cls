/**
 * Aggregates agents, queues, skills and work in one response for dashboard refresh.
 */
public with sharing class PanoramaSnapshotService {
    public class SnapshotResponse {
        public List<PanoramaAgentService.AgentDto> agents;
        public List<PanoramaQueueService.QueueDto> queues;
        public List<PanoramaSkillService.SkillDto> skills;
        public List<PanoramaWorkService.WorkItemDto> work;
        public List<PanoramaAgentService.PresenceStatusDto> presenceStatuses;
    }

    public static SnapshotResponse getSnapshot(String scope) {
        PanoramaLoadContext ctx = PanoramaLoadContext.load();
        SnapshotResponse response = new SnapshotResponse();
        response.agents = PanoramaAgentService.buildAgentsFromContext(ctx, scope);
        response.queues = PanoramaQueueService.buildQueuesFromContext(ctx);
        response.skills = PanoramaSkillService.buildSkillsFromContext(ctx);
        response.work = PanoramaWorkService.buildWorkFromContext(ctx);
        response.presenceStatuses = PanoramaAgentService.getPresenceStatuses();
        return response;
    }
}
