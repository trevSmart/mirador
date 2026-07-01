// One-off migration helper. Clears the legacy Place__c rows (cascading their
// Space__c children) so Space__c can be re-parented from Place__c to Folder__c.
// Run this BEFORE deploying the metadata that drops the Place__c master-detail.
// No schema data is preserved — the app has no other users yet.
delete [SELECT Id FROM Place__c];
