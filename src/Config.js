/**
 * Central place for Script Properties and the master list's column layout.
 * Set actual values under Project Settings -> Script Properties, never here.
 */

var SCRIPT_PROPS = PropertiesService.getScriptProperties();

function getApolloApiKey_() {
  return requireProperty_('APOLLO_API_KEY');
}

function getDigestRecipient_() {
  return requireProperty_('DIGEST_RECIPIENT_EMAIL');
}

function getMasterListSpreadsheetId_() {
  return requireProperty_('MASTER_LIST_SPREADSHEET_ID');
}

function getOutreachGuideDocId_() {
  return requireProperty_('OUTREACH_GUIDE_DOC_ID');
}

function getEmailTemplateDocId_() {
  return requireProperty_('EMAIL_TEMPLATE_DOC_ID');
}

function requireProperty_(key) {
  var value = SCRIPT_PROPS.getProperty(key);
  if (!value) {
    throw new Error('Missing Script Property "' + key + '". Set it under Project Settings -> Script Properties.');
  }
  return value;
}

/**
 * Assumed column layout for the "Master List" sheet tab.
 * Adjust these indices (0-based) to match the real sheet before running anything.
 */
var MASTER_LIST_SHEET_NAME = 'Master List';
var MASTER_LIST_COLUMNS = {
  SPONSOR_NAME: 0,
  CATEGORY: 1,
  CONTACT_NAME: 2,
  CONTACT_EMAIL: 3,
  STATUS: 4, // "Not Contacted" | "Contacted" | "Responded"
  RESPONSIBLE: 5,
  DATE_CONTACTED: 6,
  DATE_FOLLOW_UP_SENT: 7,
  NOTES: 8
};
