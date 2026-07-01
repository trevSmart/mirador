/**
 * Reads and writes the org-wide Mirador space plan: a recursive tree of
 * Folders, each holding Spaces and nested Folders. Shared: every user sees and
 * edits the same plan.
 *
 * Wire shape mirrors the front-end SpacePlanData model 1:1 so the TS repository
 * round-trips it without conversion:
 *   { v, activeFolderId, activeSpaceId, folders: [ Folder ] }
 * where Folder is { id, name, image, active, folders: [Folder], spaces: [Space] }
 * and each Space is { id, name, dir, active, cells, seats, openings, dividers }.
 *
 * Storage:
 *   - Folder__c  : one row per folder. Name, AppId__c, ParentAppId__c (blank for
 *                  a root), Image__c (base64), Active__c, SortOrder__c, plus the
 *                  plan-level ActiveFolderId__c/ActiveSpaceId__c/SchemaVersion__c.
 *                  The tree is rebuilt from AppId/ParentAppId, not SF record ids.
 *   - Space__c   : one row per space (master-detail to Folder__c). Name, AppId__c,
 *                  Direction__c, SortOrder__c, Active__c, and Geometry__c (JSON:
 *                  cells/seats/openings/dividers).
 *
 * The app's own string ids (folder_..., space_...) are persisted in the AppId__c
 * fields, not as Salesforce record ids, so a load reproduces the exact same ids
 * the editor wrote.
 */
public with sharing class MiradorSpacePlanService {

    private static final Integer DEFAULT_SCHEMA_VERSION = 4;

    // ---- DTOs (serialized to/from JSON; field names are the wire contract) ----

    public class PlanDto {
        public Integer v;
        public String activeFolderId;
        public String activeSpaceId;
        public List<FolderDto> folders;
    }

    public class FolderDto {
        public String id;
        public String name;
        public String image;
        public Boolean active;
        public List<FolderDto> folders;
        public List<SpaceDto> spaces;
    }

    public class SpaceDto {
        public String id;
        public String name;
        public Integer dir;
        public Boolean active;
        public List<List<Integer>> cells;
        public List<SeatDto> seats;
        public List<OpeningDto> openings;
        public List<DividerDto> dividers;
    }

    public class SeatDto {
        public Integer c;
        public Integer r;
        public String agentId;
    }

    public class OpeningDto {
        public Integer c;
        public Integer r;
        public String edge;
        public String kind;
    }

    public class DividerDto {
        public Integer c;
        public Integer r;
        public String edge;
    }

    // Geometry-only slice persisted in Space__c.Geometry__c.
    private class GeometryDto {
        public List<List<Integer>> cells;
        public List<SeatDto> seats;
        public List<OpeningDto> openings;
        public List<DividerDto> dividers;
    }

    // ---------------------------------------------------------------- read ----

    /**
     * Returns the org-wide space plan, or null when nothing has been saved.
     * Folders and Spaces are shared: every user sees and edits the same plan.
     */
    public static PlanDto getPlan() {
        List<Folder__c> rows = [
            SELECT Id, Name, AppId__c, ParentAppId__c, Image__c, Active__c, SortOrder__c,
                   ActiveFolderId__c, ActiveSpaceId__c, SchemaVersion__c,
                (
                    SELECT Id, Name, AppId__c, Direction__c, SortOrder__c, Geometry__c, Active__c
                    FROM Spaces__r
                    ORDER BY SortOrder__c ASC NULLS LAST, Name ASC
                )
            FROM Folder__c
            ORDER BY SortOrder__c ASC NULLS LAST, CreatedDate ASC
        ];

        if (rows.isEmpty()) {
            return null;
        }

        PlanDto plan = new PlanDto();
        plan.v = DEFAULT_SCHEMA_VERSION;
        plan.folders = new List<FolderDto>();

        // First pass: build a FolderDto per row, indexed by AppId, and remember
        // each folder's parent so we can link the tree in the second pass.
        Map<String, FolderDto> byAppId = new Map<String, FolderDto>();
        Map<String, String> parentOf = new Map<String, String>();
        List<String> order = new List<String>();
        for (Folder__c f : rows) {
            if (f.SchemaVersion__c != null) {
                plan.v = (Integer) f.SchemaVersion__c;
            }
            if (String.isNotBlank(f.ActiveFolderId__c)) {
                plan.activeFolderId = f.ActiveFolderId__c;
            }
            if (String.isNotBlank(f.ActiveSpaceId__c)) {
                plan.activeSpaceId = f.ActiveSpaceId__c;
            }

            String appId = String.isNotBlank(f.AppId__c) ? f.AppId__c : f.Id;
            FolderDto fd = new FolderDto();
            fd.id = appId;
            fd.name = f.Name;
            fd.image = f.Image__c;
            fd.active = f.Active__c == null ? true : f.Active__c;
            fd.folders = new List<FolderDto>();
            fd.spaces = new List<SpaceDto>();
            for (Space__c s : f.Spaces__r) {
                fd.spaces.add(toSpaceDto(s));
            }
            byAppId.put(appId, fd);
            parentOf.put(appId, f.ParentAppId__c);
            order.add(appId);
        }

        // Second pass: link children to parents (preserving query order); roots
        // go on the plan.
        for (String appId : order) {
            String parent = parentOf.get(appId);
            if (String.isNotBlank(parent) && byAppId.containsKey(parent)) {
                byAppId.get(parent).folders.add(byAppId.get(appId));
            } else {
                plan.folders.add(byAppId.get(appId));
            }
        }
        return plan;
    }

    private static SpaceDto toSpaceDto(Space__c s) {
        SpaceDto sd = new SpaceDto();
        sd.id = String.isNotBlank(s.AppId__c) ? s.AppId__c : s.Id;
        sd.name = s.Name;
        sd.dir = s.Direction__c == null ? 0 : (Integer) s.Direction__c;
        sd.active = s.Active__c == null ? true : s.Active__c;

        GeometryDto g = String.isBlank(s.Geometry__c)
            ? new GeometryDto()
            : (GeometryDto) JSON.deserialize(s.Geometry__c, GeometryDto.class);

        sd.cells = g.cells == null ? new List<List<Integer>>() : g.cells;
        sd.seats = g.seats == null ? new List<SeatDto>() : g.seats;
        sd.openings = g.openings == null ? new List<OpeningDto>() : g.openings;
        sd.dividers = g.dividers == null ? new List<DividerDto>() : g.dividers;
        return sd;
    }

    // --------------------------------------------------------------- write ----

    /**
     * Full replace of the org-wide plan. Deletes all existing folders (cascading
     * their spaces) and re-inserts from the payload, so the org always reflects
     * exactly what the editor saved. Shared across all users. One transaction.
     */
    public static void savePlan(PlanDto plan) {
        if (plan == null) {
            throw new SpacePlanException('Missing plan');
        }

        delete [SELECT Id FROM Folder__c];

        if (plan.folders == null || plan.folders.isEmpty()) {
            return;
        }

        Integer version = plan.v == null ? DEFAULT_SCHEMA_VERSION : plan.v;

        // Flatten the tree into folder rows keyed by AppId, and remember each
        // folder's spaces so they can be inserted once folder record ids exist.
        List<Folder__c> folderRows = new List<Folder__c>();
        Map<String, List<SpaceDto>> spacesByAppId = new Map<String, List<SpaceDto>>();
        flattenFolders(plan.folders, null, version, plan, folderRows, spacesByAppId);
        insert folderRows;

        Map<String, Id> idByAppId = new Map<String, Id>();
        for (Folder__c f : folderRows) {
            idByAppId.put(f.AppId__c, f.Id);
        }

        List<Space__c> spaceRows = new List<Space__c>();
        for (String appId : spacesByAppId.keySet()) {
            Id folderId = idByAppId.get(appId);
            Integer order = 0;
            for (SpaceDto sd : spacesByAppId.get(appId)) {
                spaceRows.add(toSpaceRow(sd, folderId, order));
                order++;
            }
        }
        if (!spaceRows.isEmpty()) {
            insert spaceRows;
        }
    }

    private static void flattenFolders(
        List<FolderDto> folders, String parentAppId, Integer version, PlanDto plan,
        List<Folder__c> outRows, Map<String, List<SpaceDto>> outSpaces
    ) {
        Integer order = 0;
        for (FolderDto fd : folders) {
            Folder__c f = new Folder__c();
            f.Name = clip(fd.name, 80);
            f.AppId__c = fd.id;
            f.ParentAppId__c = parentAppId;
            f.Image__c = fd.image;
            f.Active__c = fd.active == null ? true : fd.active;
            f.SortOrder__c = order;
            f.SchemaVersion__c = version;
            f.ActiveFolderId__c = plan.activeFolderId;
            f.ActiveSpaceId__c = plan.activeSpaceId;
            outRows.add(f);
            if (fd.spaces != null && !fd.spaces.isEmpty()) {
                outSpaces.put(fd.id, fd.spaces);
            }
            if (fd.folders != null && !fd.folders.isEmpty()) {
                flattenFolders(fd.folders, fd.id, version, plan, outRows, outSpaces);
            }
            order++;
        }
    }

    private static Space__c toSpaceRow(SpaceDto sd, Id folderId, Integer order) {
        Space__c s = new Space__c();
        s.Folder__c = folderId;
        s.Name = clip(sd.name, 80);
        s.AppId__c = sd.id;
        s.Direction__c = sd.dir == null ? 0 : sd.dir;
        s.SortOrder__c = order;
        s.Active__c = sd.active == null ? true : sd.active;

        GeometryDto g = new GeometryDto();
        g.cells = sd.cells == null ? new List<List<Integer>>() : sd.cells;
        g.seats = sd.seats == null ? new List<SeatDto>() : sd.seats;
        g.openings = sd.openings == null ? new List<OpeningDto>() : sd.openings;
        g.dividers = sd.dividers == null ? new List<DividerDto>() : sd.dividers;
        s.Geometry__c = JSON.serialize(g);
        return s;
    }

    private static String clip(String value, Integer max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }

    public class SpacePlanException extends Exception {}
}
