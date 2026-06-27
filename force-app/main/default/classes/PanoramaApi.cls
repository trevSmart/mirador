@RestResource(urlMapping='/panorama/v1/*')
global with sharing class PanoramaApi {
    private static final String API_PREFIX = '/panorama/v1';

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