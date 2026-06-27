@RestResource(urlMapping='/mirador/v1/*')
global with sharing class MiradorApi {
    private static final String API_PREFIX = '/mirador/v1';

    @HttpGet
    global static void handleGet() {
        PanoramaRestHandler.handleGet(API_PREFIX);
    }

    @HttpPut
    global static void handlePut() {
        PanoramaRestHandler.handlePut(API_PREFIX);
    }

    @HttpPost
    global static void handlePost() {
        PanoramaRestHandler.handlePost(API_PREFIX);
    }
}