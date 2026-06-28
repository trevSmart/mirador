public with sharing class MiradorRestHandler {
    public static void handleGet(String apiPrefix) {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        String path = normalizePath(req.requestURI, apiPrefix);

        try {
            if (path == '/agents') {
                String scope = req.params.get('scope');
                writeJson(res, 200, MiradorAgentService.getAgents(scope));
            } else if (path.startsWith('/agents/') && path.endsWith('/skills')) {
                String userId = path.substring('/agents/'.length(), path.length() - '/skills'.length());
                writeJson(res, 200, MiradorAgentService.getSkillsByAgent(userId));
            } else if (path == '/queues') {
                writeJson(res, 200, MiradorQueueService.getQueues());
            } else if (path == '/skills') {
                writeJson(res, 200, MiradorSkillService.getSkills());
            } else if (path.startsWith('/skills/') && path.endsWith('/agents')) {
                String skillId = path.substring('/skills/'.length(), path.length() - '/agents'.length());
                writeJson(res, 200, MiradorAgentService.getAgentsBySkill(skillId));
            } else if (path == '/work') {
                writeJson(res, 200, MiradorWorkService.getWork());
            } else if (path == '/snapshot') {
                String scope = req.params.get('scope');
                if (String.isBlank(scope)) {
                    scope = 'all';
                }
                writeJson(res, 200, MiradorSnapshotService.getSnapshot(scope));
            } else if (path == '/capabilities') {
                writeJson(res, 200, MiradorCapabilityService.getCapabilities());
            } else {
                writeJson(res, 404, new Map<String, Object>{
                    'error' => 'Not found',
                    'path' => path
                });
            }
        } catch (Exception ex) {
            writeJson(res, 500, new Map<String, Object>{
                'error' => ex.getMessage()
            });
        }
    }

    public static void handlePut(String apiPrefix) {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        String path = normalizePath(req.requestURI, apiPrefix);
        try {
            if (path.startsWith('/agents/') && path.endsWith('/skills')) {
                String userId = path.substring('/agents/'.length(), path.length() - '/skills'.length());
                if (req.requestBody == null || String.isBlank(req.requestBody.toString())) {
                    writeJson(res, 400, new Map<String, Object>{ 'error' => 'Empty request body' });
                    return;
                }
                Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(req.requestBody.toString());
                List<Object> raw = (List<Object>) body.get('changes');
                List<MiradorSkillService.SkillChange> changes = new List<MiradorSkillService.SkillChange>();
                if (raw != null) {
                    for (Object o : raw) {
                        Map<String, Object> m = (Map<String, Object>) o;
                        MiradorSkillService.SkillChange ch = new MiradorSkillService.SkillChange();
                        ch.skillId = (Id) (String) m.get('skillId');
                        ch.level = m.get('level') == null ? null : Double.valueOf(m.get('level'));
                        ch.remove = m.get('remove') == true;
                        changes.add(ch);
                    }
                }
                MiradorSkillService.updateAgentSkills((Id) userId, changes);
                writeJson(res, 200, new Map<String, Object>{ 'ok' => true });
            } else {
                writeJson(res, 404, new Map<String, Object>{ 'error' => 'Not found', 'path' => path });
            }
        } catch (MiradorSkillService.MiradorSkillException ex) {
            writeJson(res, 403, new Map<String, Object>{ 'error' => ex.getMessage() });
        } catch (Exception ex) {
            writeJson(res, 500, new Map<String, Object>{ 'error' => ex.getMessage() });
        }
    }

    public static void handlePost(String apiPrefix) {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        String path = normalizePath(req.requestURI, apiPrefix);
        try {
            if (path == '/records/details') {
                if (req.requestBody == null || String.isBlank(req.requestBody.toString())) {
                    writeJson(res, 400, new Map<String, Object>{ 'error' => 'Empty request body' });
                    return;
                }
                Object parsed;
                try {
                    parsed = JSON.deserializeUntyped(req.requestBody.toString());
                } catch (System.JSONException ex) {
                    writeJson(res, 400, new Map<String, Object>{ 'error' => 'Invalid JSON body' });
                    return;
                }
                if (!(parsed instanceof Map<String, Object>)) {
                    writeJson(res, 400, new Map<String, Object>{ 'error' => 'Invalid request body' });
                    return;
                }
                Map<String, Object> body = (Map<String, Object>) parsed;
                Object idsObj = body.get('ids');
                if (idsObj != null && !(idsObj instanceof List<Object>)) {
                    writeJson(res, 400, new Map<String, Object>{ 'error' => 'Invalid ids list' });
                    return;
                }
                List<Object> raw = (List<Object>) idsObj;
                List<Id> recordIds = new List<Id>();
                if (raw != null) {
                    for (Object o : raw) {
                        if (o == null) {
                            continue;
                        }
                        try {
                            recordIds.add((Id) String.valueOf(o));
                        } catch (System.StringException ex) {
                            writeJson(res, 400, new Map<String, Object>{ 'error' => 'Invalid id: ' + o });
                            return;
                        }
                    }
                }
                writeJson(res, 200, MiradorRecordDetailsService.getRecordDetails(recordIds));
            } else {
                writeJson(res, 404, new Map<String, Object>{ 'error' => 'Not found', 'path' => path });
            }
        } catch (Exception ex) {
            writeJson(res, 500, new Map<String, Object>{ 'error' => ex.getMessage() });
        }
    }

    private static String normalizePath(String requestUri, String apiPrefix) {
        if (String.isBlank(requestUri)) {
            return '/';
        }
        Integer marker = requestUri.indexOf(apiPrefix);
        String path = marker >= 0
            ? requestUri.substring(marker + apiPrefix.length())
            : requestUri;
        if (String.isBlank(path)) {
            return '/';
        }
        return path.endsWith('/') && path.length() > 1
            ? path.substring(0, path.length() - 1)
            : path;
    }

    private static void writeJson(RestResponse res, Integer statusCode, Object payload) {
        res.statusCode = statusCode;
        res.addHeader('Content-Type', 'application/json');
        res.responseBody = Blob.valueOf(JSON.serialize(payload));
    }
}