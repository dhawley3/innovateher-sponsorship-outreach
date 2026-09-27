/**
 * OAuth2 flow (via the community "OAuth2 for Apps Script" library) for Microsoft Graph,
 * one authorization per teammate. Tokens are keyed by a lowercased first name (matching
 * the "Team Emails" sheet / sponsor.responsible) and stored in Script Properties -- not
 * User Properties -- because the daily trigger always runs as a single fixed identity but
 * needs to create drafts in whichever teammate's mailbox actually owns that sponsor.
 *
 * The app itself is registered under a personal Azure account as a multitenant app so
 * Purdue's tenant policy -- which blocks students from self-service Azure AD app
 * registration -- doesn't apply to registering the app, only to whether Purdue later
 * allows a hawley12@purdue.edu-style account to consent to it (it currently doesn't;
 * personal Microsoft/Outlook.com accounts consent immediately with no admin approval).
 */

function getMsGraphClientId_() {
  return requireProperty_('MS_GRAPH_CLIENT_ID');
}

function getMsGraphClientSecret_() {
  return requireProperty_('MS_GRAPH_CLIENT_SECRET');
}

function getMsGraphTenant_() {
  return requireProperty_('MS_GRAPH_TENANT');
}

function normalizePersonKey_(personKey) {
  var key = String(personKey || '').trim().toLowerCase();
  if (!key) {
    throw new Error('Missing person key, e.g. "drew" (matches the Team Emails sheet name, lowercased).');
  }
  return key;
}

function getMsGraphServiceFor_(personKey) {
  return OAuth2.createService('msGraph_' + normalizePersonKey_(personKey))
    .setAuthorizationBaseUrl('https://login.microsoftonline.com/' + getMsGraphTenant_() + '/oauth2/v2.0/authorize')
    .setTokenUrl('https://login.microsoftonline.com/' + getMsGraphTenant_() + '/oauth2/v2.0/token')
    .setClientId(getMsGraphClientId_())
    .setClientSecret(getMsGraphClientSecret_())
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('offline_access Mail.ReadWrite User.Read')
    .setParam('response_type', 'code')
    .setParam('prompt', 'consent');
}

/**
 * One-time manual setup per teammate. Run this from the editor with that teammate's
 * first name (e.g. authorizeOutlookForTeammate('drew')), then send them the URL it logs --
 * they open it and sign in with their own Outlook/Microsoft account to grant consent.
 * Only one person's authorization can be in flight at a time (tracked via a Script
 * Property), which is fine since this is a one-time setup step, not a concurrent flow.
 */
function authorizeOutlookForTeammate(personKey) {
  var key = normalizePersonKey_(personKey);
  var service = getMsGraphServiceFor_(key);

  if (service.hasAccess()) {
    Logger.log(key + ' is already authorized.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('PENDING_GRAPH_AUTH_PERSON', key);
  Logger.log('Send this URL to ' + key + ' -- they should open it now and sign in with their own Outlook account: ' + service.getAuthorizationUrl());
}

/**
 * Redirect target Microsoft calls back into. The OAuth2 library auto-routes
 * https://script.google.com/macros/d/{SCRIPT_ID}/usercallback to this function -- that's
 * the exact Redirect URI registered on the Azure app, no separate Web App deployment needed.
 */
function authCallback(request) {
  var props = PropertiesService.getScriptProperties();
  var personKey = props.getProperty('PENDING_GRAPH_AUTH_PERSON');
  if (!personKey) {
    return HtmlService.createHtmlOutput('No authorization was in progress. Ask for a fresh link and try again.');
  }

  var service = getMsGraphServiceFor_(personKey);
  var isAuthorized = service.handleCallback(request);
  props.deleteProperty('PENDING_GRAPH_AUTH_PERSON');
  return HtmlService.createHtmlOutput(isAuthorized ? 'Success! You can close this tab.' : 'Denied. You can close this tab.');
}

/** Convenience wrapper since the Apps Script editor's Run button can't pass arguments. */
function authorizeOutlookForDrew() {
  authorizeOutlookForTeammate('drew');
}

function isOutlookAuthorizedForTeammate(personKey) {
  return getMsGraphServiceFor_(personKey).hasAccess();
}

function resetOutlookAuthorizationForTeammate(personKey) {
  getMsGraphServiceFor_(personKey).reset();
}
