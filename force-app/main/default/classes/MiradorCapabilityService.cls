/**
 * Write capabilities for the connected Mirador supervisor, derived from the
 * running user's object-level CRUD permissions. Shape mirrors the client's
 * MiradorCapabilities object (src/data/types.js).
 *
 * Verified against the org (2026-06-19): reassigning work and forcing another
 * agent's presence have no supported Apex/REST path, so those flags are always
 * false here (see docs/PENDING-TASKS.md).
 */
public with sharing class MiradorCapabilityService {
    public class CapabilitiesDto {
        public Boolean canChangePresence = false;
        public Boolean canReassignWork = false;
        public Boolean canChangeQueues = false;
        public Boolean canChangeSkills = false;
        public Boolean canFlagAgent = false;
        public Boolean liveUpdates = false;
    }

    public static CapabilitiesDto getCapabilities() {
        CapabilitiesDto dto = new CapabilitiesDto();
        Schema.DescribeSObjectResult srs = Schema.sObjectType.ServiceResourceSkill;
        dto.canChangeSkills = srs.isCreateable() && srs.isUpdateable() && srs.isDeletable();
        Schema.DescribeSObjectResult gm = Schema.sObjectType.GroupMember;
        dto.canChangeQueues = gm.isCreateable() && gm.isDeletable();
        // canReassignWork / canChangePresence: no backend path → stay false.
        return dto;
    }
}