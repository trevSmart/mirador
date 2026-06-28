/**
 * Reads and writes the Mirador space plan (Places + Spaces) for the running user.
 *
 * Wire shape mirrors the front-end SpacePlanData model 1:1 so the TS repository
 * round-trips it without conversion:
 *   { v, activePlaceId, places: [ { id, name, spaces: [ Space ] } ] }
 * where each Space is { id, name, dir, cells, seats, openings, dividers }.
 *
 * Storage:
 *   - Place__c   : one row per place. Name, ActiveSpaceId__c, SchemaVersion__c.
 *   - Space__c   : one row per space (master-detail to Place__c). Name, Direction__c,
 *                  SortOrder__c, and Geometry__c (JSON: cells/seats/openings/dividers).
 *
 * The app's own string ids (place_..., space_...) are persisted as data, not as
 * Salesforce record ids: Place__c stores its app id in Name-adjacent fields via the
 * plan payload, and Space__c carries it back in Geometry-independent fields. To keep
 * a stable mapping we store the app id of a place on the place row and the app id of
 * a space inside its row, so a load reproduces the exact same ids the editor wrote.
 */
public with sharing class MiradorSpacePlanService {

    private static final Integer DEFAULT_SCHEMA_VERSION = 2;

    // ---- DTOs (serialized to/from JSON; field names are the wire contract) ----

    public class PlanDto {
        public Integer v;
        public String activePlaceId;
        public List<PlaceDto> places;
    }

    public class PlaceDto {
        public String id;
        public String name;
        public List<SpaceDto> spaces;
    }

    public class SpaceDto {
        public String id;
        public String name;
        public Integer dir;
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
     * Returns the running user's space plan, or null when nothing has been saved.
     * Places are owned by the user (OwnerId); Spaces follow their parent.
     */
    public static PlanDto getPlan() {
        List<Place__c> places = [
            SELECT Id, Name, AppId__c, ActiveSpaceId__c, SchemaVersion__c,
                (
                    SELECT Id, Name, AppId__c, Direction__c, SortOrder__c, Geometry__c
                    FROM Spaces__r
                    ORDER BY SortOrder__c ASC NULLS LAST, Name ASC
                )
            FROM Place__c
            WHERE OwnerId = :UserInfo.getUserId()
            ORDER BY CreatedDate ASC
        ];

        if (places.isEmpty()) {
            return null;
        }

        PlanDto plan = new PlanDto();
        plan.v = DEFAULT_SCHEMA_VERSION;
        plan.places = new List<PlaceDto>();

        for (Place__c p : places) {
            if (p.SchemaVersion__c != null) {
                plan.v = (Integer) p.SchemaVersion__c;
            }
            if (String.isNotBlank(p.ActiveSpaceId__c)) {
                plan.activePlaceId = p.ActiveSpaceId__c;
            }

            PlaceDto pd = new PlaceDto();
            pd.id = String.isNotBlank(p.AppId__c) ? p.AppId__c : p.Id;
            pd.name = p.Name;
            pd.spaces = new List<SpaceDto>();

            for (Space__c s : p.Spaces__r) {
                pd.spaces.add(toSpaceDto(s));
            }
            plan.places.add(pd);
        }
        return plan;
    }

    private static SpaceDto toSpaceDto(Space__c s) {
        SpaceDto sd = new SpaceDto();
        sd.id = String.isNotBlank(s.AppId__c) ? s.AppId__c : s.Id;
        sd.name = s.Name;
        sd.dir = s.Direction__c == null ? 0 : (Integer) s.Direction__c;

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
     * Full replace of the running user's plan. Deletes the user's existing places
     * (cascading their spaces) and re-inserts from the payload, so the org always
     * reflects exactly what the editor saved. Runs in one transaction.
     */
    public static void savePlan(PlanDto plan) {
        if (plan == null) {
            throw new SpacePlanException('Missing plan');
        }

        List<Place__c> existing = [
            SELECT Id FROM Place__c WHERE OwnerId = :UserInfo.getUserId()
        ];
        if (!existing.isEmpty()) {
            delete existing;
        }

        if (plan.places == null || plan.places.isEmpty()) {
            return;
        }

        Integer version = plan.v == null ? DEFAULT_SCHEMA_VERSION : plan.v;

        List<Place__c> placeRows = new List<Place__c>();
        for (PlaceDto pd : plan.places) {
            Place__c p = new Place__c();
            p.Name = clip(pd.name, 80);
            p.AppId__c = pd.id;
            p.ActiveSpaceId__c = plan.activePlaceId;
            p.SchemaVersion__c = version;
            placeRows.add(p);
        }
        insert placeRows;

        List<Space__c> spaceRows = new List<Space__c>();
        for (Integer i = 0; i < plan.places.size(); i++) {
            PlaceDto pd = plan.places[i];
            if (pd.spaces == null) {
                continue;
            }
            Id placeId = placeRows[i].Id;
            Integer order = 0;
            for (SpaceDto sd : pd.spaces) {
                spaceRows.add(toSpaceRow(sd, placeId, order));
                order++;
            }
        }
        if (!spaceRows.isEmpty()) {
            insert spaceRows;
        }
    }

    private static Space__c toSpaceRow(SpaceDto sd, Id placeId, Integer order) {
        Space__c s = new Space__c();
        s.Place__c = placeId;
        s.Name = clip(sd.name, 80);
        s.AppId__c = sd.id;
        s.Direction__c = sd.dir == null ? 0 : sd.dir;
        s.SortOrder__c = order;

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
