/**
 * OAuth2 flow (via the community "OAuth2 for Apps Script" library) for Gmail, one
 * authorization per teammate -- the Google-account counterpart to MicrosoftGraphAuth.js.
 * Lets a teammate whose Team Emails entry is a personal Gmail address (not Purdue/Outlook)
 * get real drafts in their OWN Gmail Drafts folder, instead of just an emailed copy.
 *
 * GmailApp (see DraftEmails.js' createGmailDraft_) can only ever act as the Apps Script
 * project's own identity -- it can't create a draft in an arbitrary teammate's Gmail. This
 * uses a separate Google OAuth client (Cloud Console -> APIs & Services -> Credentials,
 * "Gmail Drafts (teammates)") so each teammate can grant their own gmail.compose consent,
 * same shape as the Microsoft Graph flow but talking to the Gmail API's drafts.create
 * endpoint directly since GmailApp itself has no "act as this other authorized user" mode.
 */

function getGmailDraftsServiceFor_(personKey) {
  return OAuth2.createService('gmailDrafts_' + normalizePersonKey_(personKey))
    .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/v2/auth')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setClientId(getGoogleGmailOauthClientId_())
    .setClientSecret(getGoogleGmailOauthClientSecret_())
    .setCallbackFunction('gmailDraftsAuthCallback')
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/gmail.compose')
    .setParam('access_type', 'offline')
    .setParam('prompt', 'consent');
}

/**
 * One-time manual setup per teammate. Run this from the editor with that teammate's
 * first name (e.g. authorizeGmailDraftsForTeammate('ruchira')), then send them the URL it
 * logs -- they open it and sign in with their own Gmail account to grant consent. Only one
 * person's authorization can be in flight at a time (tracked via a Script Property), same
 * as the Microsoft Graph flow, since this is a one-time setup step per teammate.
 */
function authorizeGmailDraftsForTeammate(personKey) {
  var key = normalizePersonKey_(personKey);
  var service = getGmailDraftsServiceFor_(key);

  if (service.hasAccess()) {
    Logger.log(key + ' is already authorized for Gmail drafts.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('PENDING_GMAIL_DRAFTS_AUTH_PERSON', key);
  Logger.log('Send this URL to ' + key + ' -- they should open it now and sign in with their own Gmail account: ' + service.getAuthorizationUrl());
}

function authorizeGmailDraftsForRuchira() {
  authorizeGmailDraftsForTeammate('ruchira');
}

function authorizeGmailDraftsForDrew() {
  authorizeGmailDraftsForTeammate('drew');
}

/**
 * Redirect target Google calls back into, the Gmail-OAuth counterpart to authCallback()
 * in MicrosoftGraphAuth.js. Routed the same way, via the exact Redirect URI registered on
 * the "Gmail Drafts (teammates)" OAuth client.
 */
function gmailDraftsAuthCallback(request) {
  var props = PropertiesService.getScriptProperties();
  var personKey = props.getProperty('PENDING_GMAIL_DRAFTS_AUTH_PERSON');
  if (!personKey) {
    return HtmlService.createHtmlOutput('No authorization was in progress. Ask for a fresh link and try again.');
  }

  var service = getGmailDraftsServiceFor_(personKey);
  var isAuthorized = service.handleCallback(request);
  props.deleteProperty('PENDING_GMAIL_DRAFTS_AUTH_PERSON');
  return HtmlService.createHtmlOutput(isAuthorized ? 'Success! You can close this tab.' : 'Denied. You can close this tab.');
}

function isGmailDraftsAuthorizedForTeammate(personKey) {
  return getGmailDraftsServiceFor_(personKey).hasAccess();
}

function resetGmailDraftsAuthorizationForTeammate(personKey) {
  getGmailDraftsServiceFor_(personKey).reset();
}
