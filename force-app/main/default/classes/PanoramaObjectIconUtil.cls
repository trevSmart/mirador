/**
 * Resolves Lightning icon names (e.g. standard:case, custom:custom78) from org
 * metadata. Uses TabDefinition + IconDefinition so custom object icons match Setup.
 */
public with sharing class PanoramaObjectIconUtil {
    public class IconDescriptor {
        public String objectApiName;
        /** Lightning icon name, e.g. standard:case or custom:custom78 */
        public String iconName;
        public String sprite;
        public String symbol;
    }

    private static final String DEFAULT_ICON_NAME = 'standard:case';

    /**
     * Batch-resolve icons for work item record ids (keyed by object API name).
     */
    public static Map<String, IconDescriptor> forWorkItemIds(Set<Id> recordIds) {
        Set<String> apiNames = new Set<String>();
        if (recordIds != null) {
            for (Id recordId : recordIds) {
                if (recordId == null) {
                    continue;
                }
                Schema.SObjectType soType = recordId.getSObjectType();
                if (soType != null) {
                    apiNames.add(soType.getDescribe().getName());
                }
            }
        }
        return forObjectApiNames(apiNames);
    }

    public static IconDescriptor forRecord(Id recordId) {
        if (recordId == null) {
            return defaultIcon(null);
        }
        Schema.SObjectType soType = recordId.getSObjectType();
        if (soType == null) {
            return defaultIcon(null);
        }
        String apiName = soType.getDescribe().getName();
        Map<String, IconDescriptor> icons = forObjectApiNames(new Set<String>{ apiName });
        return icons.containsKey(apiName) ? icons.get(apiName) : fallbackForApiName(apiName);
    }

    public static Map<String, IconDescriptor> forObjectApiNames(Set<String> apiNames) {
        Map<String, IconDescriptor> result = new Map<String, IconDescriptor>();
        if (apiNames == null || apiNames.isEmpty()) {
            return result;
        }

        Set<String> remaining = new Set<String>(apiNames);
        for (TabDefinition tab : [
            SELECT SobjectName,
                (SELECT Url FROM Icons WHERE ContentType = 'image/svg+xml' LIMIT 1)
            FROM TabDefinition
            WHERE SobjectName IN :apiNames
        ]) {
            String url = tab.Icons.isEmpty() ? null : tab.Icons[0].Url;
            IconDescriptor icon = fromIconUrl(url, tab.SobjectName);
            result.put(tab.SobjectName, icon);
            remaining.remove(tab.SobjectName);
        }

        for (String apiName : remaining) {
            result.put(apiName, fallbackForApiName(apiName));
        }
        return result;
    }

    @TestVisible
    private static IconDescriptor fromIconUrl(String url, String objectApiName) {
        IconDescriptor icon = new IconDescriptor();
        icon.objectApiName = objectApiName;

        if (String.isBlank(url)) {
            return fallbackForApiName(objectApiName);
        }

        Integer standardIdx = url.indexOf('/standard/');
        Integer customIdx = url.indexOf('/custom/');
        if (standardIdx >= 0) {
            icon.sprite = 'standard';
            icon.symbol = extractSymbol(url, standardIdx + '/standard/'.length());
        } else if (customIdx >= 0) {
            icon.sprite = 'custom';
            icon.symbol = extractSymbol(url, customIdx + '/custom/'.length());
        } else {
            return fallbackForApiName(objectApiName);
        }

        icon.iconName = icon.sprite + ':' + icon.symbol;
        return icon;
    }

    @TestVisible
    private static String extractSymbol(String url, Integer start) {
        String tail = url.substring(start);
        Integer dot = tail.indexOf('.');
        if (dot > 0) {
            tail = tail.substring(0, dot);
        }
        Integer underscore = tail.indexOf('_');
        if (underscore > 0) {
            tail = tail.substring(0, underscore);
        }
        return tail;
    }

    @TestVisible
    private static IconDescriptor fallbackForApiName(String objectApiName) {
        IconDescriptor icon = new IconDescriptor();
        icon.objectApiName = objectApiName;

        if (String.isBlank(objectApiName)) {
            return defaultIcon(null);
        }

        if (objectApiName.endsWith('__c')) {
            icon.sprite = 'custom';
            icon.symbol = 'custom63';
            icon.iconName = 'custom:custom63';
            return icon;
        }

        icon.sprite = 'standard';
        icon.symbol = camelToSnake(objectApiName);
        icon.iconName = 'standard:' + icon.symbol;
        return icon;
    }

    @TestVisible
    private static IconDescriptor defaultIcon(String objectApiName) {
        IconDescriptor icon = new IconDescriptor();
        icon.objectApiName = objectApiName;
        icon.iconName = DEFAULT_ICON_NAME;
        icon.sprite = 'standard';
        icon.symbol = 'case';
        return icon;
    }

    @TestVisible
    private static String camelToSnake(String apiName) {
        return apiName.replaceAll('([a-z])([A-Z])', '$1_$2').toLowerCase();
    }
}
