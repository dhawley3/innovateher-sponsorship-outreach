/**
 * Web App endpoint (Deploy -> New deployment -> Web app) so a local status page can check
 * real state without its own Google OAuth. Returns only booleans/counts, never secret
 * values or personal data. Deployment access is "Anyone" (required for an unauthenticated
 * local fetch to reach it), gated instead by a shared-secret HEALTH_CHECK_TOKEN.
 */

var HEALTH_CHECK_REQUIRED_PROPERTIES = [
  'APOLLO_API_KEY',
  'DIGEST_RECIPIENT_EMAIL',
  'MASTER_LIST_SPREADSHEET_ID',
  'OUTREACH_GUIDE_DOC_ID',
  'EMAIL_TEMPLATE_DOC_ID'
];

function doGet(e) {
  var expectedToken = SCRIPT_PROPS.getProperty('HEALTH_CHECK_TOKEN');
  var providedToken = e && e.parameter && e.parameter.token;

  if (!expectedToken || providedToken !== expectedToken) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var status = {
    scriptProperties: checkScriptProperties_(),
    categorySheets: checkCategorySheets_(),
    teamEmails: checkTeamEmails_(),
    docs: checkDocs_(),
    apollo: checkApollo_()
  };

  return ContentService.createTextOutput(JSON.stringify(status))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkScriptProperties_() {
  var result = {};
  HEALTH_CHECK_REQUIRED_PROPERTIES.forEach(function (key) {
    result[key] = !!SCRIPT_PROPS.getProperty(key);
  });
  return result;
}

function checkCategorySheets_() {
  var spreadsheetId = SCRIPT_PROPS.getProperty('MASTER_LIST_SPREADSHEET_ID');
  if (!spreadsheetId) return { ok: false, missing: CATEGORY_SHEET_NAMES };

  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var missing = CATEGORY_SHEET_NAMES.filter(function (name) {
      return !ss.getSheetByName(name);
    });
    return { ok: missing.length === 0, missing: missing };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function checkTeamEmails_() {
  try {
    var directory = getTeamDirectory_();
    var count = Object.keys(directory).length;
    return { ok: count > 0, count: count };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function checkDocs_() {
  var result = {};
  ['OUTREACH_GUIDE_DOC_ID', 'EMAIL_TEMPLATE_DOC_ID'].forEach(function (key) {
    var id = SCRIPT_PROPS.getProperty(key);
    if (!id) {
      result[key] = false;
      return;
    }
    try {
      DocumentApp.openById(id);
      result[key] = true;
    } catch (err) {
      result[key] = false;
    }
  });
  return result;
}

function checkApollo_() {
  var key = SCRIPT_PROPS.getProperty('APOLLO_API_KEY');
  if (!key) return { ok: false, message: 'No key set' };

  try {
    var response = UrlFetchApp.fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key },
      payload: JSON.stringify({ q_organization_name: 'health-check', page: 1, per_page: 1 }),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    return { ok: code < 300, message: 'HTTP ' + code };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
