/**
 * Per-user OAuth against Microsoft Graph so each finance team member's drafts land in
 * their own Outlook mailbox. Uses the community "OAuth2 for Apps Script" library
 * (already declared in appsscript.json under dependencies.libraries).
 *
 * BLOCKED until MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID exist as Script
 * Properties, which requires registering an app in the school's Azure AD tenant
 * with delegated Mail.ReadWrite permission (see README).
 */

function getMicrosoftService_() {
  return OAuth2.createService('Microsoft:' + Session.getActiveUser().getEmail())
    .setAuthorizationBaseUrl('https://login.microsoftonline.com/' + getMicrosoftTenantId_() + '/oauth2/v2.0/authorize')
    .setTokenUrl('https://login.microsoftonline.com/' + getMicrosoftTenantId_() + '/oauth2/v2.0/token')
    .setClientId(getMicrosoftClientId_())
    .setClientSecret(getMicrosoftClientSecret_())
    .setCallbackFunction('microsoftAuthCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('offline_access Mail.ReadWrite')
    .setParam('access_type', 'offline');
}

/**
 * Run this once per team member (e.g. from a custom Sheet menu item) so they can
 * authorize the script against their own Outlook mailbox.
 */
function authorizeMicrosoft() {
  var service = getMicrosoftService_();
  if (service.hasAccess()) {
    Logger.log('Already authorized for ' + Session.getActiveUser().getEmail());
    return;
  }
  var authorizationUrl = service.getAuthorizationUrl();
  Logger.log('Open this URL to authorize: ' + authorizationUrl);
  // In practice, surface this URL to the user via a UI dialog rather than just logging it.
}

function microsoftAuthCallback(request) {
  var service = getMicrosoftService_();
  var isAuthorized = service.handleCallback(request);
  return HtmlService.createHtmlOutput(isAuthorized ? 'Success! You can close this tab.' : 'Authorization denied.');
}
